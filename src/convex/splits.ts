import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserId, isValidStellarAddress, logActivity } from "./helpers";

export const TOTAL_BASIS_POINTS = 10_000;

function assertValidShares(shares: { walletAddress: string; basisPoints: number }[]) {
  if (shares.length === 0) throw new Error("Add at least one recipient");
  if (shares.length > 20) throw new Error("At most 20 recipients per split");
  const seen = new Set<string>();
  let total = 0;
  for (const s of shares) {
    if (!isValidStellarAddress(s.walletAddress)) {
      throw new Error(`Invalid recipient address: ${s.walletAddress}`);
    }
    if (seen.has(s.walletAddress)) throw new Error("Duplicate recipient addresses");
    seen.add(s.walletAddress);
    if (!Number.isInteger(s.basisPoints) || s.basisPoints <= 0) {
      throw new Error("Each share must be a positive whole percentage");
    }
    total += s.basisPoints;
  }
  if (total !== TOTAL_BASIS_POINTS) {
    throw new Error(`Shares must add up to 100% (currently ${(total / 100).toFixed(2)}%)`);
  }
}

export const list = query({
  args: { walletAddress: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let splits = await ctx.db.query("splits").order("desc").take(args.limit ?? 100);
    if (args.walletAddress) {
      splits = splits.filter((s) => s.ownerWallet === args.walletAddress);
    }
    return splits;
  },
});

export const get = query({
  args: { id: v.id("splits") },
  handler: async (ctx, args) => (await ctx.db.get(args.id)) ?? null,
});

export const createSplit = mutation({
  args: {
    ownerWallet: v.string(),
    title: v.string(),
    token: v.string(),
    shares: v.array(
      v.object({ walletAddress: v.string(), basisPoints: v.number() }),
    ),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!isValidStellarAddress(args.ownerWallet)) throw new Error("Invalid owner wallet");
    assertValidShares(args.shares);
    const token = args.token.trim().toUpperCase();
    if (token.length < 1 || token.length > 12) throw new Error("Invalid token symbol");
    const title = args.title.trim().slice(0, 80) || "Untitled split";

    const id = await ctx.db.insert("splits", {
      ownerId: (userId ?? undefined) as never,
      ownerWallet: args.ownerWallet,
      title,
      token,
      shares: args.shares.map((s) => ({
        walletAddress: s.walletAddress,
        basisPoints: s.basisPoints,
        claimed: 0,
        pending: 0,
      })),
      totalDeposited: 0,
      distributedAmount: 0,
      pendingAmount: 0,
      status: "active",
      createdAt: Date.now(),
      txHash: args.txHash,
    });

    await logActivity(ctx, {
      userId,
      walletAddress: args.ownerWallet,
      direction: "out",
      type: "split_created",
      token,
      splitId: id,
      txHash: args.txHash,
      note: `Created split "${title}"`,
    });

    return id;
  },
});

export const deposit = mutation({
  args: {
    id: v.id("splits"),
    walletAddress: v.string(),
    amount: v.number(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidStellarAddress(args.walletAddress)) throw new Error("Invalid wallet");
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new Error("Deposit must be positive");
    }
    const split = await ctx.db.get(args.id);
    if (!split) throw new Error("Split not found");
    if (split.status !== "active") throw new Error("Split is closed");

    await ctx.db.patch(split._id, { totalDeposited: split.totalDeposited + args.amount });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "out",
      type: "split_deposit",
      amount: args.amount,
      token: split.token,
      splitId: split._id,
      txHash: args.txHash,
      note: `Deposited into "${split.title}"`,
    });
    return split._id;
  },
});

/** Allocate all undistributed funds to recipients proportionally. Owner only. */
export const distribute = mutation({
  args: { id: v.id("splits"), walletAddress: v.string(), txHash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const split = await ctx.db.get(args.id);
    if (!split) throw new Error("Split not found");
    if (split.ownerWallet !== args.walletAddress) throw new Error("Only the owner can distribute");
    if (split.status !== "active") throw new Error("Split is closed");

    const allocatable = split.totalDeposited - split.distributedAmount;
    if (allocatable <= 0) throw new Error("Nothing new to distribute");

    const shares = split.shares.map((s) => ({
      ...s,
      pending: s.pending + Math.floor((allocatable * s.basisPoints) / TOTAL_BASIS_POINTS),
    }));
    const allocated = shares.reduce((sum, s) => sum + (s.pending - split.shares.find((o) => o.walletAddress === s.walletAddress)!.pending), 0);

    await ctx.db.patch(split._id, {
      shares,
      distributedAmount: split.distributedAmount + allocated,
      pendingAmount: split.pendingAmount + allocated,
    });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "out",
      type: "split_distribute",
      amount: allocated,
      token: split.token,
      splitId: split._id,
      txHash: args.txHash,
      note: `Distributed to ${shares.length} recipients`,
    });
    return split._id;
  },
});

/** Claim a recipient's allocated share. Recipient only. */
export const claim = mutation({
  args: { id: v.id("splits"), walletAddress: v.string(), txHash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const split = await ctx.db.get(args.id);
    if (!split) throw new Error("Split not found");

    const share = split.shares.find((s) => s.walletAddress === args.walletAddress);
    if (!share) throw new Error("This wallet has no share in this split");
    if (share.pending <= 0) throw new Error("Nothing to claim");

    const shares = split.shares.map((s) =>
      s.walletAddress === args.walletAddress
        ? { ...s, claimed: s.claimed + s.pending, pending: 0 }
        : s,
    );

    await ctx.db.patch(split._id, {
      shares,
      pendingAmount: split.pendingAmount - share.pending,
    });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "in",
      type: "split_claim",
      amount: share.pending,
      token: split.token,
      splitId: split._id,
      txHash: args.txHash,
      note: `Claimed from "${split.title}"`,
    });
    return split._id;
  },
});

/** Owner updates recipient shares. Only allowed while nothing is pending. */
export const updateSplit = mutation({
  args: {
    id: v.id("splits"),
    ownerWallet: v.string(),
    title: v.optional(v.string()),
    shares: v.optional(
      v.array(v.object({ walletAddress: v.string(), basisPoints: v.number() })),
    ),
  },
  handler: async (ctx, args) => {
    const split = await ctx.db.get(args.id);
    if (!split) throw new Error("Split not found");
    if (split.ownerWallet !== args.ownerWallet) throw new Error("Only the owner can update this split");
    if (split.pendingAmount > 0) {
      throw new Error("Distribute and claim before editing shares");
    }
    if (args.shares) assertValidShares(args.shares);

    await ctx.db.patch(split._id, {
      title: args.title?.trim().slice(0, 80) || split.title,
      shares: args.shares
        ? args.shares.map((s) => {
            const existing = split.shares.find((o) => o.walletAddress === s.walletAddress);
            return {
              walletAddress: s.walletAddress,
              basisPoints: s.basisPoints,
              claimed: existing?.claimed ?? 0,
              pending: existing?.pending ?? 0,
            };
          })
        : split.shares,
    });
    return split._id;
  },
});

/** Owner removes a recipient. Only allowed when that recipient has nothing pending. */
export const removeRecipient = mutation({
  args: { id: v.id("splits"), ownerWallet: v.string(), walletAddress: v.string() },
  handler: async (ctx, args) => {
    const split = await ctx.db.get(args.id);
    if (!split) throw new Error("Split not found");
    if (split.ownerWallet !== args.ownerWallet) throw new Error("Only the owner can edit this split");

    const share = split.shares.find((s) => s.walletAddress === args.walletAddress);
    if (!share) throw new Error("Recipient not in this split");
    if (share.pending > 0) throw new Error("Recipient has unclaimed funds; distribute and claim first");

    // Renormalize remaining shares back to 10_000 basis points.
    const remaining = split.shares.filter((s) => s.walletAddress !== args.walletAddress);
    const remainingTotal = remaining.reduce((sum, s) => sum + s.basisPoints, 0);
    if (remaining.length === 0) throw new Error("Cannot remove the last recipient");
    const renormalized = remaining.map((s) => ({
      ...s,
      basisPoints: Math.round((s.basisPoints / remainingTotal) * TOTAL_BASIS_POINTS),
    }));

    await ctx.db.patch(split._id, { shares: renormalized });
    return split._id;
  },
});
