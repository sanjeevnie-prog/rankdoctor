import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { createHash, randomBytes } from "node:crypto";
import { api } from "../../../convex/_generated/api";
import { diagnose } from "../../../lib/diagnose";
import type { DiagnoseRequest, DiagnoseResponse, DiagnosisJson } from "../../../lib/types";

// Node runtime — fluid compute is the Vercel default. Do not switch to edge.
export const runtime = "nodejs";

// Default vercel hobby tier caps functions at 60s; brain runs 30-150s.
// 300s is the hobby/pro fluid-compute ceiling.
export const maxDuration = 300;

const COOKIE_NAME = "wd_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

// HttpOnly so it can't be read by JS; SameSite=Lax for normal navigation;
// Secure on HTTPS so it never travels over plain HTTP in production.
function buildCookie(request: Request, cookieId: string): string {
  const isSecure =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  return [
    `${COOKIE_NAME}=${cookieId}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(isSecure ? ["Secure"] : []),
  ].join("; ");
}

function badResponse(
  reason: "rate_limited" | "cap_reached" | "internal_error",
  message: string,
  status = 200,
  setCookie?: string,
): NextResponse {
  const body: DiagnoseResponse = { ok: false, reason, message };
  const res = NextResponse.json(body, { status });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return badResponse(
      "internal_error",
      "diagnostic isn't configured yet (missing NEXT_PUBLIC_CONVEX_URL).",
      500,
    );
  }

  // ---- parse body ----
  let body: DiagnoseRequest & { optInToExamples: boolean };
  try {
    const parsed = (await request.json()) as Partial<
      DiagnoseRequest & { optInToExamples: boolean }
    >;
    if (typeof parsed.url !== "string" || typeof parsed.keyword !== "string") {
      throw new Error("missing url or keyword");
    }
    body = {
      url: parsed.url.trim(),
      keyword: parsed.keyword.trim(),
      priorRank: typeof parsed.priorRank === "number" ? parsed.priorRank : undefined,
      optInToExamples: parsed.optInToExamples === true,
    };
  } catch {
    return badResponse("internal_error", "invalid request body.", 400);
  }

  if (!body.url || !body.keyword) {
    return badResponse("internal_error", "url and keyword are required.", 400);
  }

  // ---- ip hash + cookie ----
  const ip = getClientIp(request);
  let cookieId = readCookie(request, COOKIE_NAME);
  let setCookieHeader: string | undefined;
  if (!cookieId) {
    cookieId = randomBytes(16).toString("hex");
    setCookieHeader = buildCookie(request, cookieId);
  }
  const ipHash = sha256Hex(`${ip}:${cookieId}`);

  const convex = new ConvexHttpClient(convexUrl);

  // ---- run the brain ----
  // Cap + rate-limit checks happen atomically inside the insert mutation
  // (Convex is serializable, so concurrent requests can't both pass the gate).
  let diagnosis: DiagnosisJson;
  let raw: Awaited<ReturnType<typeof diagnose>>["raw"];
  try {
    const result = await diagnose({
      url: body.url,
      keyword: body.keyword,
      priorRank: body.priorRank,
    });
    diagnosis = result.diagnosis;
    raw = result.raw;
  } catch (err) {
    console.error("diagnose() failed:", err);
    return badResponse("internal_error", "diagnosis failed. try again.", 500, setCookieHeader);
  }

  // ---- flatten brain's structured raw output for Convex persistence ----
  // IMPORTANT: Convex documents are capped at ~1MB. The full Lighthouse PSI
  // response (`raw.pagespeed.data.raw`) can be 1-3MB on its own, and Claude's
  // raw content blocks (with web_search results inside) can also balloon.
  // We strip those down to what we actually need for downstream display.
  const persistedRaw = {
    pageTextNormalized:
      raw.pageHtml.ok ? raw.pageHtml.data.normalizedText : undefined,
    waybackTextDiff:
      raw.wayback.ok ? raw.wayback.data.textDiff ?? undefined : undefined,
    waybackSnapshotCount:
      raw.wayback.ok ? raw.wayback.data.snapshotCount : undefined,
    pagespeedJson: raw.pagespeed.ok
      ? JSON.stringify({
          lcp: raw.pagespeed.data.lcp,
          cls: raw.pagespeed.data.cls,
          inp: raw.pagespeed.data.inp,
          performanceScore: raw.pagespeed.data.performanceScore,
          cruxAvailable: raw.pagespeed.data.cruxAvailable,
        })
      : undefined,
    algoUpdatesInWindowJson:
      raw.algoUpdates.ok ? JSON.stringify(raw.algoUpdates.data.updates) : undefined,
    // Keep claude's stopReason + extract just the final text block — drop the
    // server_tool_use / web_search_tool_result blocks which can be huge.
    rawClaudeResponse: JSON.stringify({
      stopReason: raw.claude.stopReason,
      finalText: raw.claude.rawContent
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n"),
    }),
  };

  // ---- persist (atomic cap + rate-limit gate inside the mutation) ----
  let shareToken: string;
  try {
    const insertResult = (await convex.mutation(api.diagnoses.insert, {
      url: body.url,
      keyword: body.keyword,
      priorRank: body.priorRank,
      diagnosisJson: JSON.stringify(diagnosis),
      pageTextNormalized: persistedRaw.pageTextNormalized,
      waybackTextDiff: persistedRaw.waybackTextDiff,
      pagespeedJson: persistedRaw.pagespeedJson,
      waybackSnapshotCount: persistedRaw.waybackSnapshotCount,
      algoUpdatesInWindowJson: persistedRaw.algoUpdatesInWindowJson,
      rawClaudeResponse: persistedRaw.rawClaudeResponse,
      optedInToExamples: body.optInToExamples,
      ipHash,
    })) as
      | { ok: true; shareToken: string; totalSubmissions: number }
      | { ok: false; reason: "cap_reached" | "rate_limited" };

    if (!insertResult.ok) {
      const message =
        insertResult.reason === "cap_reached"
          ? "saturday's beta is closed. drop your email for v2."
          : "you've used your 5 free diagnoses.";
      return badResponse(insertResult.reason, message, 200, setCookieHeader);
    }
    shareToken = insertResult.shareToken;
  } catch (err) {
    console.error("diagnoses.insert failed:", err);
    const debugMsg = err instanceof Error ? err.message : String(err);
    // TEMPORARY: surfacing the real error in production until we identify the
    // root cause of the convex insert failure. Revert once fixed.
    return badResponse(
      "internal_error",
      `couldn't save the diagnosis. [debug: ${debugMsg.slice(0, 500)}]`,
      502,
      setCookieHeader,
    );
  }

  const responseBody: DiagnoseResponse = {
    ok: true,
    diagnosis,
    share_token: shareToken,
  };
  const res = NextResponse.json(responseBody, { status: 200 });
  if (setCookieHeader) res.headers.append("Set-Cookie", setCookieHeader);
  return res;
}
