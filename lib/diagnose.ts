// Orchestrator for the diagnostic brain.
//
// Flow (per scope.md):
//   1. validate inputs
//   2. fan out 5 fetchers via Promise.allSettled — none of them throw past
//      their own boundary; each returns {ok, data?, reason?}
//   3. assemble a user message with all 5 results + priorRank
//   4. call Claude Sonnet 4.6 with the locked, cached system prompt and
//      the web_search server tool, running the SDK tool-use loop
//   5. parse & validate the JSON; one retry on bad JSON; fallback after 2nd
//   6. return {diagnosis, raw}

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./anthropic-client";
import { SYSTEM_PROMPT } from "./prompts/diagnosis-system";
import { fetchPageHtml, type PageHtmlResult } from "./fetchers/page-html";
import { fetchWayback, type WaybackResult } from "./fetchers/wayback";
import { fetchPagespeed, type PagespeedResult } from "./fetchers/pagespeed";
import { fetchAlgoUpdates, type AlgoUpdatesResult } from "./fetchers/algo-updates";
import { buildSerpSearchHint } from "./fetchers/serp";
import type {
  DiagnoseRequest,
  DiagnosisJson,
  DiagnosisCause,
  DataGap,
  Severity,
} from "./types.js";

// Locked decisions from scope.md — do not change without re-running POC.
const MODEL_ID = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
// Web search tool name. Per scope.md and Anthropic's published tool catalog,
// the GA web_search server tool type is `web_search_20250305`. If Anthropic
// renames or upgrades this in their SDK, update here.
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 5,
};

export type DiagnoseRaw = {
  pageHtml: PageHtmlResult;
  wayback: WaybackResult;
  pagespeed: PagespeedResult;
  algoUpdates: AlgoUpdatesResult;
  // serp is intentionally not a fetcher result — it's resolved inside the
  // model turn via web_search. We surface the final assistant content
  // (including any tool_use / tool_result blocks) for backend persistence.
  claude: { rawContent: Anthropic.Messages.ContentBlock[]; stopReason: string | null };
};

export async function diagnose(req: DiagnoseRequest): Promise<{
  diagnosis: DiagnosisJson;
  raw: DiagnoseRaw;
}> {
  const { url, keyword, priorRank } = req;

  // 1. Validate
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`invalid URL: ${url}`);
  }
  if (!keyword || keyword.trim() === "") {
    throw new Error("keyword is required and cannot be empty");
  }
  if (priorRank !== undefined && (!Number.isFinite(priorRank) || priorRank < 1)) {
    throw new Error(`invalid priorRank: ${priorRank}`);
  }

  const cleanUrl = parsedUrl.toString();
  const cleanKeyword = keyword.trim();

  // 2. Fan out — page first so we can pass its normalized text to wayback.
  // We still parallelize the others alongside.
  const pageHtmlPromise = fetchPageHtml(cleanUrl);
  const pagespeedPromise = fetchPagespeed(cleanUrl);
  const algoPromise = fetchAlgoUpdates();

  const pageHtml = await pageHtmlPromise.catch(
    (e: unknown): PageHtmlResult => ({
      ok: false,
      reason: `page fetch threw: ${errMsg(e)}`,
    }),
  );
  const currentText = pageHtml.ok ? pageHtml.data.normalizedText : undefined;
  const waybackPromise = fetchWayback(cleanUrl, currentText);

  const settled = await Promise.allSettled([
    pagespeedPromise,
    algoPromise,
    waybackPromise,
  ]);
  const pagespeed = unwrap<PagespeedResult>(settled[0], "pagespeed");
  const algoUpdates = unwrap<AlgoUpdatesResult>(settled[1], "algo_updates");
  const wayback = unwrap<WaybackResult>(settled[2], "wayback");

  // 3. Build the user message
  const userMessage = buildUserMessage({
    url: cleanUrl,
    keyword: cleanKeyword,
    priorRank,
    pageHtml,
    wayback,
    pagespeed,
    algoUpdates,
  });

  // 4. Call Claude with cached system prompt + web_search tool, running the loop.
  const { json, rawContent, stopReason } = await callClaudeWithRetry(userMessage);

  // 5. Parse + validate. callClaudeWithRetry already retried once.
  let diagnosis: DiagnosisJson;
  if (json && validateDiagnosis(json)) {
    // Stamp generated_at server-side regardless of what the model returned.
    diagnosis = { ...json, generated_at: Date.now() };
    diagnosis.url = cleanUrl;
    diagnosis.keyword = cleanKeyword;
    // Ensure the data_gaps list reflects what the fetchers actually reported.
    // This is belt-and-suspenders for hardening rule #3.
    diagnosis.data_gaps = mergeDataGaps(diagnosis.data_gaps ?? [], {
      pageHtml,
      wayback,
      pagespeed,
      algoUpdates,
    });
  } else {
    diagnosis = fallbackDiagnosis({
      url: cleanUrl,
      keyword: cleanKeyword,
      priorRank,
      pageHtml,
      wayback,
      pagespeed,
      algoUpdates,
    });
  }

  return {
    diagnosis,
    raw: {
      pageHtml,
      wayback,
      pagespeed,
      algoUpdates,
      claude: { rawContent, stopReason },
    },
  };
}

// ---------- helpers ----------

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function unwrap<T>(
  res: PromiseSettledResult<T>,
  source: string,
): T {
  if (res.status === "fulfilled") return res.value;
  return {
    ok: false,
    reason: `${source} threw: ${errMsg(res.reason)}`,
  } as unknown as T;
}

type BuildArgs = {
  url: string;
  keyword: string;
  priorRank: number | undefined;
  pageHtml: PageHtmlResult;
  wayback: WaybackResult;
  pagespeed: PagespeedResult;
  algoUpdates: AlgoUpdatesResult;
};

function buildUserMessage(args: BuildArgs): string {
  const { url, keyword, priorRank, pageHtml, wayback, pagespeed, algoUpdates } =
    args;

  const lines: string[] = [];
  lines.push(`URL: ${url}`);
  lines.push(`Keyword: ${keyword}`);
  // Hardening rule #2: explicit null when absent — do not omit the field.
  lines.push(
    `priorRank: ${priorRank === undefined || priorRank === null ? "null" : String(priorRank)}`,
  );
  lines.push("");
  lines.push("=== Data source 1: SERP (you must look this up) ===");
  lines.push(buildSerpSearchHint(url, keyword));
  lines.push("");

  lines.push("=== Data source 2: Page HTML (already parsed) ===");
  if (pageHtml.ok) {
    const d = pageHtml.data;
    lines.push(`title: ${nullable(d.title)}`);
    lines.push(`metaDescription: ${nullable(d.metaDescription)}`);
    lines.push(`canonical: ${nullable(d.canonical)}`);
    lines.push(`ogUrl: ${nullable(d.ogUrl)}`);
    lines.push(`h1: ${nullable(d.h1)}`);
    lines.push(`normalizedText (first 8000 chars):`);
    lines.push(d.normalizedText);
  } else {
    lines.push(`ERROR: ${pageHtml.reason}`);
  }
  lines.push("");

  lines.push("=== Data source 3: Wayback snapshots (last 90-365 days) ===");
  if (wayback.ok) {
    lines.push(`snapshotCount: ${wayback.data.snapshotCount}`);
    if (wayback.data.snapshots.length > 0) {
      lines.push(
        `mostRecentSnapshot: ${wayback.data.snapshots[0].ts} (${wayback.data.snapshots[0].url})`,
      );
    }
    lines.push(`textDiff: ${wayback.data.textDiff ?? "null"}`);
  } else {
    lines.push(`ERROR: ${wayback.reason}`);
  }
  lines.push("");

  lines.push("=== Data source 4: PageSpeed (mobile, Core Web Vitals) ===");
  if (pagespeed.ok) {
    const d = pagespeed.data;
    lines.push(`performanceScore: ${nullableNum(d.performanceScore)}`);
    lines.push(`LCP_ms: ${nullableNum(d.lcp)}`);
    lines.push(`CLS: ${nullableNum(d.cls)}`);
    lines.push(`INP_ms: ${nullableNum(d.inp)}`);
  } else {
    lines.push(`ERROR: ${pagespeed.reason}`);
  }
  lines.push("");

  lines.push("=== Data source 5: Google algorithm updates in last 90 days ===");
  if (algoUpdates.ok) {
    if (algoUpdates.data.updates.length === 0) {
      lines.push("(no confirmed updates in window)");
    } else {
      for (const u of algoUpdates.data.updates) {
        lines.push(`- ${u.date} | ${u.name} | type=${u.type} | severity=${u.severity}`);
      }
    }
  } else {
    lines.push(`ERROR: ${algoUpdates.reason}`);
  }
  lines.push("");

  lines.push(
    "Diagnose now. Return ONLY the JSON object specified in your system prompt — no prose, no markdown, no code fences.",
  );
  return lines.join("\n");
}

function nullable(v: string | null | undefined): string {
  return v === null || v === undefined ? "null" : JSON.stringify(v);
}

function nullableNum(v: number | null | undefined): string {
  return v === null || v === undefined ? "null" : String(v);
}

// Run the SDK tool-use loop until Claude returns end_turn (no more tool calls).
// `web_search` is a server-side tool — Anthropic executes the search; we never
// see the request leave our box. The SDK still surfaces server_tool_use blocks
// for transparency.
async function runToolLoop(
  userMessage: string,
): Promise<{
  finalText: string | null;
  rawContent: Anthropic.Messages.ContentBlock[];
  stopReason: string | null;
}> {
  const client = getAnthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Up to 3 turns: user -> assistant(tool_use) -> assistant(... -> end_turn).
  // web_search server tool means we don't manually feed tool results back —
  // when Anthropic resolves the search server-side, it appends the result and
  // the model continues. If we get pause_turn we re-send to resume.
  let lastContent: Anthropic.Messages.ContentBlock[] = [];
  let lastStop: string | null = null;

  for (let turn = 0; turn < 4; turn++) {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [WEB_SEARCH_TOOL],
      messages,
    });

    lastContent = response.content;
    lastStop = response.stop_reason ?? null;

    if (response.stop_reason === "end_turn") {
      break;
    }
    if (response.stop_reason === "pause_turn") {
      // Server-side tool hit its iteration limit; re-send to resume.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "tool_use") {
      // For web_search (server tool) the server already executed it and the
      // tool_result is in the same response content. Re-send to let the
      // model continue reasoning over the result.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    // Anything else (max_tokens, refusal, stop_sequence) — stop and let
    // the parser try.
    break;
  }

  const finalText = extractText(lastContent);
  return { finalText, rawContent: lastContent, stopReason: lastStop };
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string | null {
  const chunks: string[] = [];
  for (const block of content) {
    if (block.type === "text") chunks.push(block.text);
  }
  if (chunks.length === 0) return null;
  return chunks.join("\n").trim();
}

async function callClaudeWithRetry(userMessage: string): Promise<{
  json: unknown | null;
  rawContent: Anthropic.Messages.ContentBlock[];
  stopReason: string | null;
}> {
  const first = await runToolLoop(userMessage);
  const firstParsed = tryParseJson(first.finalText);
  if (firstParsed !== null) {
    return { json: firstParsed, rawContent: first.rawContent, stopReason: first.stopReason };
  }

  // Retry once: nudge the model to return JSON only.
  const retryMessage =
    userMessage +
    "\n\nThe previous response was not valid JSON. Return ONLY the JSON object — no prose, no markdown, no code fences.";
  const second = await runToolLoop(retryMessage);
  const secondParsed = tryParseJson(second.finalText);
  return { json: secondParsed, rawContent: second.rawContent, stopReason: second.stopReason };
}

function tryParseJson(text: string | null): unknown | null {
  if (!text) return null;
  // Strip the most common stray wrappers: code fences, leading prose.
  let candidate = text.trim();
  // ```json ... ```
  const fence = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) candidate = fence[1].trim();
  // Find the first '{' and last '}' to slice out a bare object.
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) {
    candidate = candidate.slice(first, last + 1);
  }
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// ---------- validation ----------

function validateDiagnosis(v: unknown): v is DiagnosisJson {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.url !== "string") return false;
  if (typeof o.keyword !== "string") return false;
  if (typeof o.expected_recovery !== "string") return false;
  if (!Array.isArray(o.causes)) return false;
  if (!Array.isArray(o.data_gaps)) return false;
  if (!o.rank_info || typeof o.rank_info !== "object") return false;

  const ri = o.rank_info as Record<string, unknown>;
  if (typeof ri.history_available !== "boolean") return false;

  for (const c of o.causes) {
    if (!c || typeof c !== "object") return false;
    const cc = c as Record<string, unknown>;
    if (cc.severity !== "critical" && cc.severity !== "high" && cc.severity !== "medium") {
      return false;
    }
    if (typeof cc.headline !== "string") return false;
    if (typeof cc.explanation !== "string") return false;
    if (typeof cc.fix !== "string") return false;
    if (cc.confidence !== undefined && typeof cc.confidence !== "number") return false;
  }

  for (const g of o.data_gaps) {
    if (!g || typeof g !== "object") return false;
    const gg = g as Record<string, unknown>;
    const validSources = ["serp", "page_html", "wayback", "pagespeed", "algo_updates"];
    if (typeof gg.source !== "string" || !validSources.includes(gg.source)) return false;
    if (typeof gg.reason !== "string") return false;
  }

  return true;
}

// Guarantee that any failed fetcher shows up in data_gaps even if the model
// forgot to add it. Hardening rule #3.
function mergeDataGaps(
  modelGaps: DataGap[],
  results: {
    pageHtml: PageHtmlResult;
    wayback: WaybackResult;
    pagespeed: PagespeedResult;
    algoUpdates: AlgoUpdatesResult;
  },
): DataGap[] {
  const merged: DataGap[] = [...modelGaps];
  const has = (source: DataGap["source"]) =>
    merged.some((g) => g.source === source);

  if (!results.pageHtml.ok && !has("page_html")) {
    merged.push({ source: "page_html", reason: results.pageHtml.reason });
  }
  if (!results.wayback.ok && !has("wayback")) {
    merged.push({ source: "wayback", reason: results.wayback.reason });
  }
  if (!results.pagespeed.ok && !has("pagespeed")) {
    merged.push({ source: "pagespeed", reason: results.pagespeed.reason });
  }
  if (!results.algoUpdates.ok && !has("algo_updates")) {
    merged.push({ source: "algo_updates", reason: results.algoUpdates.reason });
  }
  return merged;
}

// ---------- fallback ----------

function fallbackDiagnosis(args: BuildArgs): DiagnosisJson {
  const { url, keyword, priorRank, pageHtml, wayback, pagespeed, algoUpdates } =
    args;

  const cause: DiagnosisCause = {
    severity: "high" as Severity,
    headline: "diagnosis incomplete",
    explanation:
      "The diagnostic brain could not produce a structured response on this run. The supporting data was collected (see data_gaps and the raw payload), but the model output did not validate.",
    fix: "Re-run the diagnosis. If this repeats on the same URL, the brain may need a sharper prompt for this case — file it in the POC log.",
  };

  const gaps: DataGap[] = mergeDataGaps(
    [{ source: "serp", reason: "the brain failed to return a valid JSON diagnosis" }],
    { pageHtml, wayback, pagespeed, algoUpdates },
  );

  const rankInfo =
    priorRank === undefined || priorRank === null
      ? { history_available: false as const, current_rank: null }
      : {
          history_available: true as const,
          current_rank: null,
          prior_rank: priorRank,
          drop: 0,
        };

  return {
    url,
    keyword,
    rank_info: rankInfo,
    expected_recovery: "unknown — diagnosis incomplete",
    causes: [cause],
    data_gaps: gaps,
    generated_at: Date.now(),
  };
}
