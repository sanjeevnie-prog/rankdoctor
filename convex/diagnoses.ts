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

export const insert = mutation({
  args: {
    url: v.string(),
    keyword: v.string(),
    priorRank: v.optional(v.number()),
    diagnosisJson: v.string(),
    serpPositionCurrent: v.optional(v.number()),
    pageTextNormalized: v.optional(v.string()),
    waybackTextDiff: v.optional(v.string()),
    pagespeedJson: v.optional(v.string()),
    waybackSnapshotCount: v.optional(v.number()),
    algoUpdatesInWindowJson: v.optional(v.string()),
    rawClaudeResponse: v.optional(v.string()),
    optedInToExamples: v.boolean(),
    ipHash: v.string(),
  },
  returns: v.object({
    shareToken: v.string(),
    totalSubmissions: v.number(),
  }),
  handler: async (ctx, args) => {
    const shareToken = generateShareToken();

    await ctx.db.insert("diagnoses", {
      url: args.url,
      keyword: args.keyword,
      priorRank: args.priorRank,
      diagnosisJson: args.diagnosisJson,
      serpPositionCurrent: args.serpPositionCurrent,
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

    // atomically increment meta.totalSubmissions, creating the row on first run
    const metaRow = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    let totalSubmissions: number;
    if (metaRow === null) {
      totalSubmissions = 1;
      await ctx.db.insert("meta", {
        key: "global",
        totalSubmissions,
      });
    } else {
      totalSubmissions = metaRow.totalSubmissions + 1;
      await ctx.db.patch(metaRow._id, { totalSubmissions });
    }

    return { shareToken, totalSubmissions };
  },
});

// option B opt-in flow: user ticks the checkbox AFTER seeing the diagnosis.
// frontend POSTs /api/diagnose-optin with { share_token, optedIn }, which calls this.
// idempotent — calling with the same value is a no-op.
export const setOptIn = mutation({
  args: {
    shareToken: v.string(),
    optedIn: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { shareToken, optedIn }) => {
    const row = await ctx.db
      .query("diagnoses")
      .withIndex("by_share_token", (q) => q.eq("shareToken", shareToken))
      .unique();
    if (row === null) {
      // never leak existence; silently accept
      return null;
    }
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
          drop: v.number(),
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
      return null;
    }
    if (typeof parsed !== "object" || parsed === null) return null;

    const d = parsed as {
      url?: string;
      keyword?: string;
      rank_info?: unknown;
      expected_recovery?: string;
      causes?: unknown;
      data_gaps?: unknown;
      generated_at?: number;
    };

    if (
      typeof d.url !== "string" ||
      typeof d.keyword !== "string" ||
      typeof d.expected_recovery !== "string" ||
      typeof d.generated_at !== "number" ||
      !Array.isArray(d.causes) ||
      !Array.isArray(d.data_gaps) ||
      typeof d.rank_info !== "object" ||
      d.rank_info === null
    ) {
      return null;
    }

    // Hand back ONLY the public, validated shape. Private fields stay in the row.
    return {
      url: d.url,
      keyword: d.keyword,
      rank_info: d.rank_info as
        | { history_available: true; current_rank: number | null; prior_rank: number; drop: number }
        | { history_available: false; current_rank: number | null },
      expected_recovery: d.expected_recovery,
      causes: d.causes as Array<{
        severity: "critical" | "high" | "medium";
        headline: string;
        explanation: string;
        fix: string;
        confidence?: number;
      }>,
      data_gaps: d.data_gaps as Array<{
        source: "serp" | "page_html" | "wayback" | "pagespeed" | "algo_updates";
        reason: string;
      }>,
      generated_at: d.generated_at,
      share_token: row.shareToken,
    };
  },
});

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
    const rows = await ctx.db
      .query("diagnoses")
      .withIndex("by_approved", (q) => q.eq("approvedForPublic", true))
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
    const metaRow = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const total = metaRow?.totalSubmissions ?? 0;
    const cap = 250;
    return { total, cap, closed: total >= cap };
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

