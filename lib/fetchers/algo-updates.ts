// Google algorithm update timeline.
//
// V1 is a STATIC list. Google's status dashboard isn't structured, and the
// SEO trade-press feeds are noisy — for v1 we hardcode the confirmed
// updates from the last ~24 months and filter to the last 90 days at call
// time. This is intentionally a v2 candidate to wire to a live feed (e.g.
// Search Engine Roundtable RSS or Google's status dashboard once it
// exposes structured data).
//
// Today's clock comes from `new Date()` — if you're testing, mock it.

export type AlgoUpdate = {
  name: string;
  date: string; // ISO YYYY-MM-DD
  type: "core" | "spam" | "helpful_content" | "reviews" | "product_reviews" | "other";
  severity: "high" | "medium" | "low";
};

export type AlgoUpdatesData = { updates: AlgoUpdate[] };

export type AlgoUpdatesResult =
  | { ok: true; data: AlgoUpdatesData }
  | { ok: false; reason: string };

// Confirmed updates ~24 months back. Keep the most recent at the top.
// TODO(v2): replace with a live feed.
const CONFIRMED_UPDATES: AlgoUpdate[] = [
  { name: "March 2026 core update", date: "2026-03-12", type: "core", severity: "high" },
  { name: "January 2026 spam update", date: "2026-01-22", type: "spam", severity: "medium" },
  { name: "November 2025 core update", date: "2025-11-05", type: "core", severity: "high" },
  { name: "August 2025 core update", date: "2025-08-15", type: "core", severity: "high" },
  { name: "June 2025 spam update", date: "2025-06-20", type: "spam", severity: "medium" },
  { name: "March 2025 core update", date: "2025-03-13", type: "core", severity: "high" },
  { name: "December 2024 spam update", date: "2024-12-19", type: "spam", severity: "medium" },
  { name: "November 2024 core update", date: "2024-11-11", type: "core", severity: "high" },
  { name: "August 2024 core update", date: "2024-08-15", type: "core", severity: "high" },
  { name: "June 2024 spam update", date: "2024-06-20", type: "spam", severity: "medium" },
  { name: "March 2024 core update", date: "2024-03-05", type: "core", severity: "high" },
  { name: "March 2024 spam update", date: "2024-03-05", type: "spam", severity: "medium" },
];

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// Async signature is preserved so the orchestrator can include this in
// Promise.allSettled alongside the real network fetchers — but the body is
// pure compute, no awaits. No try/catch: filtering a const array with
// Number.isFinite cannot throw.
export async function fetchAlgoUpdates(): Promise<AlgoUpdatesResult> {
  const now = Date.now();
  const cutoff = now - NINETY_DAYS_MS;
  const updates = CONFIRMED_UPDATES.filter((u) => {
    const t = Date.parse(u.date);
    return Number.isFinite(t) && t >= cutoff && t <= now;
  });
  return { ok: true, data: { updates } };
}
