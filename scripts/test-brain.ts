#!/usr/bin/env tsx
// CLI runner for round 4 brain validation.
//
// Usage:
//   npm run brain -- "<url>" "<keyword>" [priorRank]
//
// Pretty-prints the DiagnosisJson to stdout, and writes the full result
// (diagnosis + raw side-channel data) to ./tmp/brain-<unix-ms>.json.

// Load .env.local before any other imports. Next.js auto-loads it for the
// dev server, but the CLI runs under plain Node, so we wire it manually.
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });

import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { diagnose } from "../lib/diagnose.js";
import type { DiagnosisCause, Severity } from "../lib/types.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";

function colorFor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return RED;
    case "high":
      return YELLOW;
    case "medium":
      return GREEN;
  }
}

function colorize(text: string, color: string): string {
  if (!process.stdout.isTTY) return text;
  return `${color}${text}${RESET}`;
}

function printCause(c: DiagnosisCause, idx: number): void {
  const dot = colorize("●", colorFor(c.severity));
  const sev = colorize(c.severity.toUpperCase(), colorFor(c.severity));
  const conf =
    c.confidence !== undefined
      ? colorize(`  confidence: ${(c.confidence * 100).toFixed(0)}%`, DIM)
      : "";
  console.log(`\n${dot} ${colorize(`#${idx + 1}`, BOLD)}  ${sev}${conf}`);
  console.log(`  ${colorize(c.headline, BOLD)}`);
  console.log(`  ${c.explanation}`);
  console.log(`  ${colorize("fix:", DIM)} ${c.fix}`);
}

async function main() {
  const [, , urlArg, keywordArg, priorRankArg] = process.argv;
  if (!urlArg || !keywordArg) {
    console.error(
      "usage: npm run brain -- \"<url>\" \"<keyword>\" [priorRank]",
    );
    process.exit(2);
  }

  const priorRank = priorRankArg !== undefined ? Number(priorRankArg) : undefined;
  if (priorRankArg !== undefined && (!Number.isFinite(priorRank) || (priorRank as number) < 1)) {
    console.error(`invalid priorRank: ${priorRankArg}`);
    process.exit(2);
  }

  console.log(colorize("→ diagnosing…", DIM));
  console.log(colorize(`  url: ${urlArg}`, DIM));
  console.log(colorize(`  keyword: ${keywordArg}`, DIM));
  if (priorRank !== undefined) {
    console.log(colorize(`  priorRank: ${priorRank}`, DIM));
  }

  const started = Date.now();
  const { diagnosis, raw } = await diagnose({
    url: urlArg,
    keyword: keywordArg,
    priorRank,
  });
  const ms = Date.now() - started;

  // Pretty print
  console.log("");
  console.log(colorize("══ diagnosis ══", BOLD));
  console.log(`URL:     ${diagnosis.url}`);
  console.log(`Keyword: ${diagnosis.keyword}`);
  if (diagnosis.rank_info.history_available) {
    const ri = diagnosis.rank_info;
    console.log(
      `Rank:    ${colorize(`${ri.prior_rank} → ${ri.current_rank ?? "?"}`, BOLD)}  (drop ${ri.drop})`,
    );
  } else {
    console.log(
      `Rank:    ${colorize(`current ${diagnosis.rank_info.current_rank ?? "unknown"}`, BOLD)}  (no history)`,
    );
  }
  console.log(colorize(`Recovery: ${diagnosis.expected_recovery}`, CYAN));

  if (diagnosis.causes.length === 0) {
    console.log("\n(no causes returned)");
  } else {
    diagnosis.causes.forEach(printCause);
  }

  if (diagnosis.data_gaps.length > 0) {
    console.log(colorize("\n── data gaps ──", DIM));
    for (const g of diagnosis.data_gaps) {
      console.log(colorize(`  ${g.source}: ${g.reason}`, DIM));
    }
  }

  console.log(colorize(`\ncompleted in ${ms}ms`, DIM));

  // Write full output to tmp/
  const tmpDir = resolve(process.cwd(), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const outPath = resolve(tmpDir, `brain-${Date.now()}.json`);
  await writeFile(outPath, JSON.stringify({ diagnosis, raw }, null, 2));
  console.log(colorize(`wrote ${outPath}`, DIM));
}

main().catch((err) => {
  console.error("brain failed:", err);
  process.exit(1);
});
