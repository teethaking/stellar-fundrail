import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accruedAmount, claimableAmount } from "../lib/stream-math";
import { getCurrentUserId, isValidStellarAddress, logActivity } from "./helpers";

export const list = query({
  args: {
    walletAddress: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let streams = await ctx.db.query("streams").order("desc").take(args.limit ?? 200);

    if (args.walletAddress) {
      streams = streams.filter(
        (s) => s.senderWallet === args.walletAddress || s.recipientWallet === args.walletAddress,
      );
    }
    if (args.status) {
      streams = streams.filter((s) => s.status === args.status);
    }

    return streams.map((s) => ({
      ...s,
      claimable: claimableAmount(s, now),
      accrued: accruedAmount(s, now),
    }));
  },
});

export const get = query({
  args: { id: v.id("streams") },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.id);
    if (!stream) return null;
    const now = Date.now();
    return {
      ...stream,
      claimable: claimableAmount(stream, now),
      accrued: accruedAmount(stream, now),
    };
  },
});

export const createStream = mutation({
  args: {
    senderWallet: v.string(),
    recipientWallet: v.string(),
    token: v.string(),
    totalAmount: v.number(), // base units to stream over the window
    startTime: v.number(), // ms epoch
    endTime: v.number(), // ms epoch
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    if (!isValidStellarAddress(args.senderWallet)) throw new Error("Invalid sender wallet");
    if (!isValidStellarAddress(args.recipientWallet)) throw new Error("Invalid recipient wallet");
    if (args.recipientWallet === args.senderWallet) {
      throw new Error("Recipient must be different from the sender");
    }
    const token = args.token.trim().toUpperCase();
    if (token.length < 1 || token.length > 12) throw new Error("Invalid token symbol");
    if (!Number.isFinite(args.totalAmount) || args.totalAmount <= 0) {
      throw new Error("Total amount must be positive");
    }
    if (!Number.isFinite(args.startTime) || args.startTime < now - 60_000) {
      throw new Error("Start time must be now or in the future");
    }
    if (!Number.isFinite(args.endTime) || args.endTime <= args.startTime) {
      throw new Error("End time must be after the start time");
    }
    if (args.endTime - args.startTime < 60_000) {
      throw new Error("Stream must last at least 1 minute");
    }

    const rate = Math.floor(args.totalAmount / (args.endTime - args.startTime));
    if (rate <= 0) throw new Error("Amount too small for the chosen duration");

    const id = await ctx.db.insert("streams", {
      senderId: (userId ?? undefined) as never,
      senderWallet: args.senderWallet,
      recipientWallet: args.recipientWallet,
      token,
      startTime: args.startTime,
      endTime: args.endTime,
      rate,
      totalAmount: args.totalAmount,
      withdrawnAmount: 0,
      pausedDuration: 0,
      status: "active",
      createdAt: now,
      txHash: args.txHash,
    });

    await logActivity(ctx, {
      userId,
      walletAddress: args.senderWallet,
      direction: "out",
      type: "stream_created",
      amount: args.totalAmount,
      token,
      counterparty: args.recipientWallet,
      streamId: id,
      txHash: args.txHash,
      note: `Created a ${token} stream`,
    });

    return id;
  },
});

/** Pause accrual. Only the sender may pause, and only while active. */
export const pauseStream = mutation({
  args: { id: v.id("streams"), walletAddress: v.string() },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.id);
    if (!stream) throw new Error("Stream not found");
    if (stream.senderWallet !== args.walletAddress) {
      throw new Error("Only the sender can pause this stream");
    }
    if (stream.status !== "active") throw new Error("Stream is not active");

    await ctx.db.patch(stream._id, { status: "paused", lastPausedAt: Date.now() });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "out",
      type: "stream_paused",
      streamId: stream._id,
      note: "Stream paused",
    });
    return stream._id;
  },
});

/** Resume a paused stream, folding the paused window into pausedDuration. */
export const resumeStream = mutation({
  args: { id: v.id("streams"), walletAddress: v.string() },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.id);
    if (!stream) throw new Error("Stream not found");
    if (stream.senderWallet !== args.walletAddress) {
      throw new Error("Only the sender can resume this stream");
    }
    if (stream.status !== "paused" || stream.lastPausedAt == null) {
      throw new Error("Stream is not paused");
    }

    const pausedFor = Date.now() - stream.lastPausedAt;
    await ctx.db.patch(stream._id, {
      status: "active",
      pausedDuration: stream.pausedDuration + pausedFor,
      lastPausedAt: undefined,
    });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "out",
      type: "stream_resumed",
      streamId: stream._id,
      note: "Stream resumed",
    });
    return stream._id;
  },
});

/** Cancel a stream. Only the sender may cancel; accrued-but-unwithdrawn funds
 *  are lost, exactly like the on-chain contract. */
export const cancelStream = mutation({
  args: { id: v.id("streams"), walletAddress: v.string() },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.id);
    if (!stream) throw new Error("Stream not found");
    if (stream.senderWallet !== args.walletAddress) {
      throw new Error("Only the sender can cancel this stream");
    }
    if (stream.status === "cancelled" || stream.status === "completed") {
      throw new Error("Stream is already closed");
    }

    await ctx.db.patch(stream._id, { status: "cancelled", endTime: Date.now() });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "out",
      type: "stream_cancelled",
      streamId: stream._id,
      note: "Stream cancelled",
    });
    return stream._id;
  },
});

/** Withdraw accrued funds. Only the recipient may withdraw, and never more
 *  than the claimable balance (no double withdrawals). */
export const withdrawStream = mutation({
  args: { id: v.id("streams"), walletAddress: v.string(), txHash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const stream = await ctx.db.get(args.id);
    if (!stream) throw new Error("Stream not found");
    if (stream.recipientWallet !== args.walletAddress) {
      throw new Error("Only the recipient can withdraw");
    }
    if (stream.status === "cancelled") throw new Error("Stream was cancelled");

    const now = Date.now();
    const claimable = claimableAmount(stream, now);
    if (claimable <= 0) throw new Error("Nothing to withdraw yet");

    const withdrawnAmount = stream.withdrawnAmount + claimable;
    const status = withdrawnAmount >= stream.totalAmount ? "completed" : stream.status;

    await ctx.db.patch(stream._id, { withdrawnAmount, status });

    const userId = await getCurrentUserId(ctx);
    await logActivity(ctx, {
      userId,
      walletAddress: args.walletAddress,
      direction: "in",
      type: "stream_withdraw",
      amount: claimable,
      token: stream.token,
      counterparty: stream.senderWallet,
      streamId: stream._id,
      txHash: args.txHash,
      note: "Withdrew from stream",
    });

    return { withdrawnAmount: claimable, status };
  },
});
