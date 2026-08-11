import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUserId,
  isValidStellarAddress,
  logActivity,
  slugify,
} from "./helpers";

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
    tag: v.optional(v.string()),
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 100);

    return projects
      .filter((p) => {
        if (args.status && p.status !== args.status) return false;
        if (args.tag && !p.tags.includes(args.tag)) return false;
        if (args.q) {
          const q = args.q.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => b.totalReceived - a.totalReceived);
  },
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .take(1);
    return projects[0] ?? null;
  },
});

export const byWallet = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    if (!isValidStellarAddress(args.walletAddress)) return [];
    return await ctx.db
      .query("projects")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .collect();
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    githubUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    walletAddress: v.string(),
    creatorWallet: v.optional(v.string()),
    metadataUri: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) throw new Error("Sign in to register a project");
    if (args.name.trim().length < 3) throw new Error("Name must be at least 3 characters");
    if (args.description.trim().length < 20) {
      throw new Error("Description must be at least 20 characters");
    }
    if (!isValidStellarAddress(args.walletAddress)) {
      throw new Error("Project wallet must be a valid Stellar address (G...)");
    }

    const base = slugify(args.name);
    let slug = base;
    let n = 2;
    while ((await ctx.db.query("projects").filter((q) => q.eq(q.field("slug"), slug)).take(1)).length > 0) {
      slug = `${base}-${n++}`;
    }

    const id = await ctx.db.insert("projects", {
      slug,
      name: args.name.trim(),
      description: args.description.trim(),
      githubUrl: args.githubUrl,
      website: args.website,
      walletAddress: args.walletAddress,
      creatorId: userId,
      creatorWallet: args.creatorWallet,
      metadataUri: args.metadataUri,
      tags: args.tags.slice(0, 6),
      status: "active",
      totalReceived: 0,
      supporterCount: 0,
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      userId,
      walletAddress: args.creatorWallet ?? args.walletAddress,
      direction: "out",
      type: "project_registered",
      counterparty: slug,
      projectId: id,
      note: `Registered "${args.name.trim()}"`,
    });

    return { id, slug };
  },
});

export const updateProject = mutation({
  args: {
    slug: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    metadataUri: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) throw new Error("Sign in to update a project");
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .take(1);
    const project = projects[0];
    if (!project) throw new Error("Project not found");
    if (project.creatorId !== userId) throw new Error("Only the project creator can update it");

    await ctx.db.patch(project._id, {
      name: args.name ?? project.name,
      description: args.description ?? project.description,
      githubUrl: args.githubUrl !== undefined ? args.githubUrl : project.githubUrl,
      website: args.website !== undefined ? args.website : project.website,
      metadataUri: args.metadataUri !== undefined ? args.metadataUri : project.metadataUri,
      tags: args.tags ?? project.tags,
    });

    await logActivity(ctx, {
      userId,
      walletAddress: project.walletAddress,
      direction: "out",
      type: "project_updated",
      counterparty: project.slug,
      projectId: project._id,
      note: `Updated "${project.name}"`,
    });

    return project._id;
  },
});

/** One-off donation to a project's wallet (recorded on the ledger). */
export const supportProject = mutation({
  args: {
    slug: v.string(),
    amount: v.number(),
    token: v.string(),
    fromWallet: v.string(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidStellarAddress(args.fromWallet)) {
      throw new Error("Invalid sender wallet");
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new Error("Amount must be positive");
    }
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .take(1);
    const project = projects[0];
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(project._id, {
      totalReceived: project.totalReceived + args.amount,
      supporterCount: project.supporterCount + 1,
    });

    const userId = await getCurrentUserId(ctx);

    // Outgoing side: the donor.
    await logActivity(ctx, {
      userId,
      walletAddress: args.fromWallet,
      direction: "out",
      type: "donation",
      amount: args.amount,
      token: args.token,
      counterparty: project.slug,
      projectId: project._id,
      txHash: args.txHash,
      note: `Donated to ${project.name}`,
    });

    // Incoming side: the project's wallet.
    await logActivity(ctx, {
      walletAddress: project.walletAddress,
      direction: "in",
      type: "donation",
      amount: args.amount,
      token: args.token,
      counterparty: args.fromWallet,
      projectId: project._id,
      txHash: args.txHash,
      note: `Received from ${shortWallet(args.fromWallet)}`,
    });

    return project._id;
  },
});

function shortWallet(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}
