import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {
    walletAddress: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("in"), v.literal("out"))),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let activities = await ctx.db
      .query("activities")
      .order("desc")
      .take(args.limit ?? 100);

    if (args.walletAddress) {
      activities = activities.filter((a) => a.walletAddress === args.walletAddress);
    }
    if (args.direction) {
      activities = activities.filter((a) => a.direction === args.direction);
    }
    if (args.type) {
      activities = activities.filter((a) => a.type === args.type);
    }
    return activities;
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("activities").order("desc").take(args.limit ?? 20);
  },
});
