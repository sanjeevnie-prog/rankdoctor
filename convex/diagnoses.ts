import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

// ---- helpers ----

// derive a 2-3 line summary of the top finding from the stored diagnosisJson string.
// must never throw — return "" on any malformed input.
function topFindingSummary(diagnosisJson: string): string {
  try {
    const parsed = JSON.parse(diagnosisJson) as {
      causes?: Array<{ headline?: unknown; explanation?: unknown }>;
    };
    const first = parsed.causes?.[0];
    if (!first) return "";
    const headline = typeof first.headline === "string" ? first.headline : "";
    const explanation = typeof first.explanation === "string" ? first.explanation : "";
    // first sentence of the explanation
    const firstSentence = explanation.split(/(?<=[.!?])\s+/)[0] ?? "";
    if (headline && firstSentence) return `${headline} — ${firstSentence}`;
    return headline || firstSentence || "";
  } catch {
    return "";
  }
}

// Limits — single source of truth across the cap + rate-limit checks.
const CAP = 250;
const RATE_LIMIT = 5;

// 32-char crypto-safe random hex token (16 bytes).
// uses Web Crypto so it works in Convex's runtime.
function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

// ---- mutations ----

// All cap + rate-limit checks live INSIDE this mutation so they can't race.
// Convex mutations are serializable, so two concurrent inserts at total=249
// will not both succeed — the second one re-reads meta and bails on the cap.
//
// Returns one of:
//   { ok: true, shareToken, totalSubmissions } — happy path
//   { ok: false, reason: "cap_reached" }       — global 250 hit
//   { ok: false, reason: "rate_limited" }      — this ipHash already at 5
export const insert = mutation({
  args: {
    url: v.string(),
    keyword: v.string(),
    priorRank: v.optional(v.number()),
    diagnosisJson: v.string(),
    pageTextNormalized: v.optional(v.string()),
    waybackTextDiff: v.optional(v.string()),
    pagespeedJson: v.optional(v.string()),
    waybackSnapshotCount: v.optional(v.number()),
    algoUpdatesInWindowJson: v.optional(v.string()),
    rawClaudeResponse: v.optional(v.string()),
    optedInToExamples: v.boolean(),
    ipHash: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      shareToken: v.string(),
      totalSubmissions: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("cap_reached"), v.literal("rate_limited")),
    }),
  ),
  handler: async (ctx, args) => {
    // ---- atomic cap check ----
    // Use .first() (not .unique()) so a duplicate meta row from a vanishingly
    // rare first-write race never crashes the query. Order by _creationTime
    // so the oldest row is always the canonical counter — subsequent runs
    // converge on it and any stray dup is harmless (worst case: counter is
    // off by ≤2 across the whole beta).
    const metaRow = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .order("asc")
      .first();
    const total = metaRow?.totalSubmissions ?? 0;
    if (total >= CAP) {
      return { ok: false as const, reason: "cap_reached" as const };
    }

    // ---- atomic rate-limit check ----
    const userRows = await ctx.db
      .query("diagnoses")
      .withIndex("by_ip_hash", (q) => q.eq("ipHash", args.ipHash))
      .collect();
    if (userRows.length >= RATE_LIMIT) {
      return { ok: false as const, reason: "rate_limited" as const };
    }

    // ---- insert + increment counter ----
    const shareToken = generateShareToken();

    await ctx.db.insert("diagnoses", {
      url: args.url,
      keyword: args.keyword,
      priorRank: args.priorRank,
      diagnosisJson: args.diagnosisJson,
      pageTextNormalized: args.pageTextNormalized,
      waybackTextDiff: args.waybackTextDiff,
      pagespeedJson: args.pagespeedJson,
      waybackSnapshotCount: args.waybackSnapshotCount,
      algoUpdatesInWindowJson: args.algoUpdatesInWindowJson,
      rawClaudeResponse: args.rawClaudeResponse,
      shareToken,
      optedInToExamples: args.optedInToExamples,
      approvedForPublic: false,
      ipHash: args.ipHash,
      createdAt: Date.now(),
    });

    const totalSubmissions = total + 1;
    if (metaRow === null) {
      await ctx.db.insert("meta", {
        key: "global",
        totalSubmissions,
      });
    } else {
      await ctx.db.patch(metaRow._id, { totalSubmissions });
    }

    return { ok: true as const, shareToken, totalSubmissions };
  },
});

// option B opt-in flow: user ticks the checkbox AFTER seeing the diagnosis.
// frontend POSTs /api/diagnose-optin which forwards the caller's ipHash so we
// can verify the toggler is the original submitter. silent no-op when the row
// is missing OR the ipHash doesn't match (don't leak existence either way).
// idempotent: calling with the same value is a no-op.
export const setOptIn = mutation({
  args: {
    shareToken: v.string(),
    optedIn: v.boolean(),
    ipHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { shareToken, optedIn, ipHash }) => {
    const row = await ctx.db
      .query("diagnoses")
      .withIndex("by_share_token", (q) => q.eq("shareToken", shareToken))
      .unique();
    if (row === null) return null;
    if (row.ipHash !== ipHash) return null;
    if (row.optedInToExamples !== optedIn) {
      await ctx.db.patch(row._id, { optedInToExamples: optedIn });
    }
    return null;
  },
});

export const approve = mutation({
  args: {
    id: v.id("diagnoses"),
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { id, key }) => {
    if (key !== process.env.ADMIN_KEY) {
      throw new Error("unauthorized");
    }
    await ctx.db.patch(id, { approvedForPublic: true });
    return null;
  },
});

// ---- queries ----

// Option A — public share-page query. Returns ONLY the fields the public
// `/d/{token}` page is allowed to see. Private fields (ipHash, rawClaudeResponse,
// raw fetcher dumps, priorRank-as-input) physically don't leave the database,
// so they can't leak via page source, dev tools, or future export bugs.
//
// Also unwraps the stored `diagnosisJson` string into the rendered shape so
// the consumer doesn't have to re-parse.
export const getByShareToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      keyword: v.string(),
      rank_info: v.union(
        v.object({
          history_available: v.literal(true),
          current_rank: v.union(v.number(), v.null()),
          prior_rank: v.number(),
          drop: v.union(v.number(), v.null()),
        }),
        v.object({
          history_available: v.literal(false),
          current_rank: v.union(v.number(), v.null()),
        }),
      ),
      expected_recovery: v.string(),
      causes: v.array(
        v.object({
          severity: v.union(
            v.literal("critical"),
            v.literal("high"),
            v.literal("medium"),
          ),
          headline: v.string(),
          explanation: v.string(),
          fix: v.string(),
          confidence: v.optional(v.number()),
        }),
      ),
      data_gaps: v.array(
        v.object({
          source: v.union(
            v.literal("serp"),
            v.literal("page_html"),
            v.literal("wayback"),
            v.literal("pagespeed"),
            v.literal("algo_updates"),
          ),
          reason: v.string(),
        }),
      ),
      generated_at: v.number(),
      share_token: v.string(),
    }),
  ),
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("diagnoses")
      .withIndex("by_share_token", (q) => q.eq("shareToken", token))
      .unique();
    if (row === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.diagnosisJson);
    } catch {
      console.warn(`getByShareToken: malformed diagnosisJson for ${token}`);
      return null;
    }
    const validated = validatePublicDiagnosis(parsed, row.shareToken);
    if (validated === null) {
      // 404s on /d/{token} are otherwise indistinguishable from "row missing"
      // — log so we can tell when the validator dropped a row vs. a real miss.
      console.warn(`getByShareToken: diagnosis failed shape validation for ${token}`);
    }
    return validated;
  },
});

// Strict structural validator for the option-A public shape. Any deviation
// from the expected schema returns null — never throw, never let Convex's
// return-validator reject mid-flight (which would surface as a query error
// to the consumer instead of a clean 404).
type PublicDiagnosis = {
  url: string;
  keyword: string;
  rank_info:
    | { history_available: true; current_rank: number | null; prior_rank: number; drop: number | null }
    | { history_available: false; current_rank: number | null };
  expected_recovery: string;
  causes: Array<{
    severity: "critical" | "high" | "medium";
    headline: string;
    explanation: string;
    fix: string;
    confidence?: number;
  }>;
  data_gaps: Array<{
    source: "serp" | "page_html" | "wayback" | "pagespeed" | "algo_updates";
    reason: string;
  }>;
  generated_at: number;
  share_token: string;
};

function validatePublicDiagnosis(
  parsed: unknown,
  shareToken: string,
): PublicDiagnosis | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as Record<string, unknown>;

  if (
    typeof d.url !== "string" ||
    typeof d.keyword !== "string" ||
    typeof d.expected_recovery !== "string" ||
    typeof d.generated_at !== "number"
  ) {
    return null;
  }

  // rank_info — discriminated union, validate per branch
  const ri = d.rank_info;
  if (typeof ri !== "object" || ri === null) return null;
  const rir = ri as Record<string, unknown>;
  let rank_info: PublicDiagnosis["rank_info"];
  if (rir.history_available === true) {
    if (typeof rir.prior_rank !== "number") return null;
    // drop may be null when current_rank is null
    if (rir.drop !== null && typeof rir.drop !== "number") return null;
    if (rir.current_rank !== null && typeof rir.current_rank !== "number") return null;
    rank_info = {
      history_available: true,
      current_rank: rir.current_rank as number | null,
      prior_rank: rir.prior_rank,
      drop: rir.drop as number | null,
    };
  } else if (rir.history_available === false) {
    if (rir.current_rank !== null && typeof rir.current_rank !== "number") return null;
    rank_info = {
      history_available: false,
      current_rank: rir.current_rank as number | null,
    };
  } else {
    return null;
  }

  // causes
  if (!Array.isArray(d.causes)) return null;
  const causes: PublicDiagnosis["causes"] = [];
  const validSeverities = ["critical", "high", "medium"] as const;
  for (const c of d.causes) {
    if (typeof c !== "object" || c === null) return null;
    const cc = c as Record<string, unknown>;
    if (
      typeof cc.severity !== "string" ||
      !validSeverities.includes(cc.severity as (typeof validSeverities)[number]) ||
      typeof cc.headline !== "string" ||
      typeof cc.explanation !== "string" ||
      typeof cc.fix !== "string"
    ) {
      return null;
    }
    if (cc.confidence !== undefined && typeof cc.confidence !== "number") return null;
    causes.push({
      severity: cc.severity as PublicDiagnosis["causes"][number]["severity"],
      headline: cc.headline,
      explanation: cc.explanation,
      fix: cc.fix,
      ...(typeof cc.confidence === "number" ? { confidence: cc.confidence } : {}),
    });
  }

  // data_gaps
  if (!Array.isArray(d.data_gaps)) return null;
  const data_gaps: PublicDiagnosis["data_gaps"] = [];
  const validSources = ["serp", "page_html", "wayback", "pagespeed", "algo_updates"] as const;
  for (const g of d.data_gaps) {
    if (typeof g !== "object" || g === null) return null;
    const gg = g as Record<string, unknown>;
    if (
      typeof gg.source !== "string" ||
      !validSources.includes(gg.source as (typeof validSources)[number]) ||
      typeof gg.reason !== "string"
    ) {
      return null;
    }
    data_gaps.push({
      source: gg.source as PublicDiagnosis["data_gaps"][number]["source"],
      reason: gg.reason,
    });
  }

  return {
    url: d.url,
    keyword: d.keyword,
    rank_info,
    expected_recovery: d.expected_recovery,
    causes,
    data_gaps,
    generated_at: d.generated_at,
    share_token: shareToken,
  };
}

export const listApproved = query({
  args: {},
  returns: v.array(
    v.object({
      shareToken: v.string(),
      url: v.string(),
      keyword: v.string(),
      topFindingSummary: v.string(),
    }),
  ),
  handler: async (ctx) => {
    // both opted-in AND approved — submitter could have toggled opt-in off
    // after approval, in which case the row should drop off the public list.
    const rows = await ctx.db
      .query("diagnoses")
      .withIndex("by_pending", (q) =>
        q.eq("optedInToExamples", true).eq("approvedForPublic", true),
      )
      .order("desc")
      .collect();
    return rows.map((r: Doc<"diagnoses">) => ({
      shareToken: r.shareToken,
      url: r.url,
      keyword: r.keyword,
      topFindingSummary: topFindingSummary(r.diagnosisJson),
    }));
  },
});

export const listPendingApproval = query({
  args: { key: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("diagnoses"),
      url: v.string(),
      keyword: v.string(),
      createdAt: v.number(),
      topFindingSummary: v.string(),
    }),
  ),
  handler: async (ctx, { key }) => {
    if (key !== process.env.ADMIN_KEY) {
      // never leak existence — empty list whether or not rows exist
      return [];
    }
    const rows = await ctx.db
      .query("diagnoses")
      .withIndex("by_pending", (q) =>
        q.eq("optedInToExamples", true).eq("approvedForPublic", false),
      )
      .order("desc")
      .collect();
    return rows.map((r: Doc<"diagnoses">) => ({
      _id: r._id,
      url: r.url,
      keyword: r.keyword,
      createdAt: r.createdAt,
      topFindingSummary: topFindingSummary(r.diagnosisJson),
    }));
  },
});

export const getCapStatus = query({
  args: {},
  returns: v.object({
    total: v.number(),
    cap: v.number(),
    closed: v.boolean(),
  }),
  handler: async (ctx) => {
    // Use .first() (not .unique()) so a duplicate meta row from a vanishingly
    // rare first-write race never crashes the query. Order by _creationTime
    // so the oldest row is always the canonical counter — subsequent runs
    // converge on it and any stray dup is harmless (worst case: counter is
    // off by ≤2 across the whole beta).
    const metaRow = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .order("asc")
      .first();
    const total = metaRow?.totalSubmissions ?? 0;
    return { total, cap: CAP, closed: total >= CAP };
  },
});

export const countByIpHash = query({
  args: { ipHash: v.string() },
  returns: v.number(),
  handler: async (ctx, { ipHash }) => {
    const rows = await ctx.db
      .query("diagnoses")
      .withIndex("by_ip_hash", (q) => q.eq("ipHash", ipHash))
      .collect();
    return rows.length;
  },
});

// ---- waitlistV2 (overflow capture) ----

export const addWaitlistV2 = mutation({
  args: {
    email: v.string(),
    source: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { email, source }) => {
    await ctx.db.insert("waitlistV2", {
      email: email.trim().toLowerCase(),
      source,
      createdAt: Date.now(),
    });
    return null;
  },
});

