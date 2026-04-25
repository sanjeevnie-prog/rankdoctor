// Wayback Machine snapshot fetcher.
//
// CDX is primary (per scope.md): /wayback/available? was unreliable in POC.
// Look back 90 days first; if no hits, widen to 365.
// Pull the most recent snapshot's raw HTML (id_ flag) and produce a small
// summary diff against the live page text — never a full diff.

import { parse } from "node-html-parser";

// Wayback's CDX API + the archived-raw fetch can each take 20-40s on cold
// snapshots or unindexed URLs. 15s was failing in round 4 testing — bumped
// to 60s. This still completes inside the pagespeed timeout (90s), so it
// doesn't extend overall diagnosis wall-clock time.
const FETCH_TIMEOUT_MS = 60_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; seo-diagnostic-bot/1.0; +https://growthx.club)";

export type WaybackSnapshot = { ts: string; url: string };

export type WaybackData = {
  snapshotCount: number;
  snapshots: WaybackSnapshot[];
  textDiff: string | null;
};

export type WaybackResult =
  | { ok: true; data: WaybackData }
  | { ok: false; reason: string };

// Accepts current page text either as a string OR a promise resolving to one.
// The promise form lets the orchestrator fire wayback in parallel with the
// page-html fetcher; wayback only awaits the page just before computing the
// diff (after its own network work is done), so neither blocks the other.
export async function fetchWayback(
  url: string,
  currentNormalizedText?: string | Promise<string | undefined>,
): Promise<WaybackResult> {
  try {
    let cdxRows = await cdx(url, 90);
    if (cdxRows.length === 0) {
      cdxRows = await cdx(url, 365);
    }

    if (cdxRows.length === 0) {
      return {
        ok: true,
        data: { snapshotCount: 0, snapshots: [], textDiff: null },
      };
    }

    const snapshots: WaybackSnapshot[] = cdxRows.map((row) => ({
      ts: row.timestamp,
      url: `https://web.archive.org/web/${row.timestamp}/${row.original}`,
    }));

    // Most recent first. Sort numerically: CDX timestamps are 14-digit
    // YYYYMMDDhhmmss, but defending against any odd-length row keeps the
    // "newest" picker honest.
    snapshots.sort((a, b) => Number(b.ts) - Number(a.ts));

    let textDiff: string | null = null;
    const resolvedText = await Promise.resolve(currentNormalizedText);
    if (resolvedText && snapshots.length > 0) {
      try {
        const newest = snapshots[0];
        const newestRow = cdxRows.find((r) => r.timestamp === newest.ts);
        // newest was built from cdxRows, so the find must match. If it
        // somehow doesn't, bail on the diff rather than fall back to the
        // input URL (which may differ from the canonical archived URL).
        if (!newestRow) throw new Error("newest snapshot row missing from cdx");
        const archivedRaw = await fetchArchivedRaw(newest.ts, newestRow.original);
        if (archivedRaw) {
          textDiff = summarizeDiff(resolvedText, archivedRaw);
        }
      } catch {
        // Diff is best-effort. Keep snapshot list even if diff fails.
        textDiff = null;
      }
    }

    return {
      ok: true,
      data: { snapshotCount: snapshots.length, snapshots, textDiff },
    };
  } catch (err) {
    const reason =
      err instanceof Error ? `wayback failed: ${err.message}` : "wayback failed";
    return { ok: false, reason };
  }
}

type CdxRow = { timestamp: string; original: string };

async function cdx(url: string, daysBack: number): Promise<CdxRow[]> {
  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fromStr = ymd(from);
  const toStr = ymd(now);

  const cdxUrl =
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
    `&output=json&limit=20&filter=statuscode:200&from=${fromStr}&to=${toStr}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(cdxUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || json.length < 2) return [];
    // First row is the column header.
    const header = json[0] as string[];
    const tsIdx = header.indexOf("timestamp");
    const origIdx = header.indexOf("original");
    if (tsIdx < 0 || origIdx < 0) return [];
    return (json.slice(1) as string[][]).map((row) => ({
      timestamp: row[tsIdx],
      original: row[origIdx],
    }));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArchivedRaw(ts: string, original: string): Promise<string | null> {
  // id_ flag → raw HTML, no wayback toolbar injection
  const url = `https://web.archive.org/web/${ts}id_/${original}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const root = parse(html);
    for (const sel of ["script", "style", "nav", "footer", "noscript"]) {
      for (const n of root.querySelectorAll(sel)) n.remove();
    }
    return root.text.replace(/\s+/g, " ").trim();
  } finally {
    clearTimeout(timer);
  }
}

// Lightweight diff: word-set delta + a small surface of new/missing headings.
// Cap at 200 chars so the user message stays cheap.
function summarizeDiff(current: string, archived: string): string {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

  const cur = new Set(tokenize(current));
  const old = new Set(tokenize(archived));
  let added = 0;
  let removed = 0;
  for (const w of cur) if (!old.has(w)) added++;
  for (const w of old) if (!cur.has(w)) removed++;

  // Find a couple of distinctive added/removed phrases (longer-word tokens).
  const distinctiveAdded = [...cur]
    .filter((w) => !old.has(w) && w.length >= 6)
    .slice(0, 3)
    .join(", ");
  const distinctiveRemoved = [...old]
    .filter((w) => !cur.has(w) && w.length >= 6)
    .slice(0, 3)
    .join(", ");

  let out = `+${added} unique words added, -${removed} removed`;
  if (distinctiveAdded) out += `; new: ${distinctiveAdded}`;
  if (distinctiveRemoved) out += `; gone: ${distinctiveRemoved}`;
  return out.length > 200 ? out.slice(0, 200) : out;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
