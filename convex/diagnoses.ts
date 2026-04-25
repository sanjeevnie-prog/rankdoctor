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

export const getByShareToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("diagnoses"),
      _creationTime: v.number(),
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
      shareToken: v.string(),
      optedInToExamples: v.boolean(),
      approvedForPublic: v.boolean(),
      ipHash: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("diagnoses")
      .withIndex("by_share_token", (q) => q.eq("shareToken", token))
      .unique();
    return row;
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

