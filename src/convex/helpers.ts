import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { ActivityType } from "./schema";

/** Stellar public keys are `G` + 55 chars from the StrKey base32 alphabet. */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function isValidStellarAddress(address: string | undefined | null): boolean {
  return typeof address === "string" && STELLAR_ADDRESS_RE.test(address);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function getCurrentUserId(ctx: MutationCtx | QueryCtx) {
  return await getAuthUserId(ctx);
}

/** Append an entry to the public activity ledger. */
export async function logActivity(
  ctx: MutationCtx,
  entry: {
    walletAddress: string;
    direction: "in" | "out";
    type: ActivityType;
    amount?: number;
    token?: string;
    counterparty?: string;
    projectId?: string;
    streamId?: string;
    splitId?: string;
    txHash?: string;
    note?: string;
    userId?: string | null;
  },
) {
  await ctx.db.insert("activities", {
    userId: (entry.userId ?? undefined) as never,
    walletAddress: entry.walletAddress,
    direction: entry.direction,
    type: entry.type,
    amount: entry.amount ?? undefined,
    token: entry.token,
    counterparty: entry.counterparty,
    projectId: entry.projectId as never,
    streamId: entry.streamId as never,
    splitId: entry.splitId as never,
    txHash: entry.txHash,
    note: entry.note,
    createdAt: Date.now(),
  });
}
