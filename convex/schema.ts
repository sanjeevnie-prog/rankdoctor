import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // existing ninety waitlist — leave alone
  waitlist: defineTable({
    email: v.string(),
    source: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // SEO ranking drop diagnostic
  diagnoses: defineTable({
    url: v.string(),
    keyword: v.string(),
    priorRank: v.optional(v.number()),
    // JSON-serialized DiagnosisJson — convex can't store discriminated unions cleanly
    diagnosisJson: v.string(),
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
  })
    .index("by_share_token", ["shareToken"])
    .index("by_ip_hash", ["ipHash"])
    .index("by_approved", ["approvedForPublic"])
    .index("by_pending", ["optedInToExamples", "approvedForPublic"]),

  // single-row global counter
  meta: defineTable({
    key: v.string(),
    totalSubmissions: v.number(),
  }).index("by_key", ["key"]),

  // overflow email capture for cap/rate-limit hits
  waitlistV2: defineTable({
    email: v.string(),
    source: v.string(), // "rate_limited" | "cap_reached"
    createdAt: v.number(),
  }),
});
