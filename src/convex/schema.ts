import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const streamStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("cancelled"),
  v.literal("completed"),
);
export type StreamStatus = Infer<typeof streamStatusValidator>;

export const activityTypeValidator = v.union(
  v.literal("donation"),
  v.literal("project_registered"),
  v.literal("project_updated"),
  v.literal("stream_created"),
  v.literal("stream_withdraw"),
  v.literal("stream_paused"),
  v.literal("stream_resumed"),
  v.literal("stream_cancelled"),
  v.literal("split_created"),
  v.literal("split_deposit"),
  v.literal("split_distribute"),
  v.literal("split_claim"),
);
export type ActivityType = Infer<typeof activityTypeValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // --- FundRail: decentralized funding & contribution platform ---

    /** Public registry of funded projects (mirrors the on-chain ProjectRegistry
     *  contract; heavy metadata lives off-chain behind metadataUri). */
    projects: defineTable({
      slug: v.string(), // human-readable id, e.g. "soroban-sdk-rs"
      name: v.string(),
      description: v.string(),
      githubUrl: v.optional(v.string()),
      website: v.optional(v.string()),
      walletAddress: v.string(), // Stellar address that receives funding
      creatorId: v.optional(v.id("users")),
      creatorWallet: v.optional(v.string()),
      metadataUri: v.optional(v.string()),
      tags: v.array(v.string()),
      status: v.union(v.literal("active"), v.literal("archived")),
      totalReceived: v.number(), // total in base units of the funding token
      supporterCount: v.number(),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_wallet", ["walletAddress"]),

    /** Recurring funding streams (mirrors the on-chain FundingStream contract).
     *  Amounts are integers in the token's base units; rate is base units/sec. */
    streams: defineTable({
      senderId: v.optional(v.id("users")),
      senderWallet: v.string(),
      recipientWallet: v.string(),
      token: v.string(), // symbol, e.g. "USDC"
      startTime: v.number(),
      endTime: v.number(),
      rate: v.number(), // base units per second
      totalAmount: v.number(), // rate * (end - start), escrowed
      withdrawnAmount: v.number(),
      pausedDuration: v.number(), // total ms of paused time (accrual is frozen)
      lastPausedAt: v.optional(v.number()), // set while paused, cleared on resume
      status: streamStatusValidator,
      createdAt: v.number(),
      txHash: v.optional(v.string()),
    })
      .index("by_sender_wallet", ["senderWallet"])
      .index("by_recipient_wallet", ["recipientWallet"])
      .index("by_sender", ["senderId"])
      .index("by_created", ["createdAt"]),

    /** Payment splits (mirrors the on-chain Splitter contract).
     *  shares[i].basisPoints is the recipient's share in basis points (1/100th
     *  of a percent); the sum of shares must equal 10_000. */
    splits: defineTable({
      ownerId: v.optional(v.id("users")),
      ownerWallet: v.string(),
      title: v.string(),
      token: v.string(),
      shares: v.array(
        v.object({
          walletAddress: v.string(),
          basisPoints: v.number(), // share of 10_000
          claimed: v.number(), // base units already claimed by this recipient
          pending: v.number(), // base units allocated but not yet claimed
        }),
      ),
      totalDeposited: v.number(),
      distributedAmount: v.number(),
      pendingAmount: v.number(), // allocated but not yet claimed
      status: v.union(v.literal("active"), v.literal("closed")),
      createdAt: v.number(),
      txHash: v.optional(v.string()),
    })
      .index("by_owner_wallet", ["ownerWallet"])
      .index("by_owner", ["ownerId"])
      .index("by_created", ["createdAt"]),

    /** Append-only activity ledger shown in /activity and on the dashboard. */
    activities: defineTable({
      userId: v.optional(v.id("users")),
      walletAddress: v.string(), // wallet that performed (or received) the action
      direction: v.union(v.literal("in"), v.literal("out")),
      type: activityTypeValidator,
      amount: v.optional(v.number()),
      token: v.optional(v.string()),
      counterparty: v.optional(v.string()), // other wallet or project slug
      projectId: v.optional(v.id("projects")),
      streamId: v.optional(v.id("streams")),
      splitId: v.optional(v.id("splits")),
      txHash: v.optional(v.string()),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_wallet", ["walletAddress"])
      .index("by_user", ["userId"])
      .index("by_created", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
