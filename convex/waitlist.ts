import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
  },
  returns: v.object({
    isNew: v.boolean(),
  }),
  handler: async (ctx, { email, source }) => {
    const normalized = email.trim().toLowerCase();

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (existing) {
      return { isNew: false };
    }

    await ctx.db.insert("waitlist", {
      email: normalized,
      source,
      createdAt: Date.now(),
    });

    return { isNew: true };
  },
});

export const count = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("waitlist").collect();
    return rows.length;
  },
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("waitlist"),
      _creationTime: v.number(),
      email: v.string(),
      source: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("waitlist")
      .order("desc")
      .take(limit ?? 100);
  },
});
