import { v } from "convex/values";
import { mutation } from "./_generated/server";

/** Public demo wallet used by "Connect demo wallet" mode. */
export const DEMO_WALLET = "GD3KYNFZVN2BQZH6JBGM3T47RKUUDAQYZDEIFQ6X5LZ7UVVWO57XCAJQ";
export const DEMO_RECIPIENT = "GDK72JBRC75GSQWHVICSWANTEEVCRHFL2OKGK545WANDXLR547QHS3ZE";
export const DEMO_ALICE = "GCQX5JZ3EY7V3EGW24EMQ6MH2XJ7D4PZNQTTQPPVSFNI6XWBEPKTX7B4";
export const DEMO_BOB = "GD355TIVGVDXZGSZA2CPEUDMA5DXKATLM262TJ22XQZ2AXPXK446MAG4";
export const DEMO_CAROL = "GDV53QVIL3JTTUR676EZ34ZHCYTZXJJPCAZVIGP4VVJ4YUYAL3KBT45R";

const NOW = Date.now();
const DAY = 86_400_000;

interface SeedProject {
  slug: string;
  name: string;
  description: string;
  githubUrl: string;
  website: string;
  walletAddress: string;
  tags: string[];
  totalReceived: number;
  supporterCount: number;
  createdAt: number;
}

const PROJECTS: SeedProject[] = [
  {
    slug: "soroban-sdk-rs",
    name: "soroban-sdk-rs",
    description:
      "Rust SDK for writing Soroban smart contracts. Maintains the builder toolchain, contract macros, and test harness that every contract on Stellar's testnet runs on.",
    githubUrl: "https://github.com/stellar/soroban-sdk-rs",
    website: "https://soroban.stellar.org",
    walletAddress: DEMO_RECIPIENT,
    tags: ["rust", "contracts", "tooling"],
    totalReceived: 2_450_000,
    supporterCount: 318,
    createdAt: NOW - 200 * DAY,
  },
  {
    slug: "stellar-lumen",
    name: "Stellar Lumen Indexer",
    description:
      "Open-source indexer that watches Stellar testnet and mainnet ledgers, normalizing payments and contract events into a queryable REST + GraphQL API used by dozens of dApps.",
    githubUrl: "https://github.com/stellar/stellar-indexer",
    website: "https://stellar.org",
    walletAddress: DEMO_ALICE,
    tags: ["infrastructure", "indexer", "data"],
    totalReceived: 1_180_500,
    supporterCount: 142,
    createdAt: NOW - 160 * DAY,
  },
  {
    slug: "drips-protocol",
    name: "Drips Protocol",
    description:
      "The public-goods funding protocol this platform is inspired by: recurring streams, splits, and one-time donations that keep open-source maintainers funded sustainably.",
    githubUrl: "https://github.com/radicle-dev/drips-contracts",
    website: "https://drips.network",
    walletAddress: DEMO_BOB,
    tags: ["public-goods", "streams", "funding"],
    totalReceived: 3_600_000,
    supporterCount: 421,
    createdAt: NOW - 260 * DAY,
  },
  {
    slug: "freighter-wallet",
    name: "Freighter Wallet",
    description:
      "The browser extension wallet for Stellar. Supports Soroban smart contract signing, hardware wallets, and Ledger integration. Funding keeps audit and release engineering rolling.",
    githubUrl: "https://github.com/stellar/freighter",
    website: "https://freighter.app",
    walletAddress: DEMO_CAROL,
    tags: ["wallet", "security", "browser"],
    totalReceived: 1_920_000,
    supporterCount: 264,
    createdAt: NOW - 180 * DAY,
  },
  {
    slug: "soroban-cli",
    name: "Soroban CLI",
    description:
      "Command-line interface for building, deploying, and interacting with Soroban contracts. The day-to-day tool for every contract developer on Stellar.",
    githubUrl: "https://github.com/stellar/soroban-cli",
    website: "https://developers.stellar.org/docs/tools/cli",
    walletAddress: DEMO_RECIPIENT,
    tags: ["rust", "cli", "tooling"],
    totalReceived: 780_000,
    supporterCount: 96,
    createdAt: NOW - 140 * DAY,
  },
  {
    slug: "public-goods-radio",
    name: "Public Goods Radio",
    description:
      "Community-run podcast and research collective covering quadratic funding, retroactive public goods, and the maintainers keeping open-source alive.",
    githubUrl: "https://github.com/publicgoodsradio/pgr",
    website: "https://publicgoodsradio.org",
    walletAddress: DEMO_ALICE,
    tags: ["media", "community", "public-goods"],
    totalReceived: 415_000,
    supporterCount: 88,
    createdAt: NOW - 90 * DAY,
  },
  {
    slug: "stellar-docs",
    name: "Stellar Developer Docs",
    description:
      "Documentation for the Stellar network: getting started guides, Soroban references, and wallet integration playbooks. Every contribution improves onboarding for new builders.",
    githubUrl: "https://github.com/stellar/docs",
    website: "https://developers.stellar.org",
    walletAddress: DEMO_BOB,
    tags: ["docs", "education", "community"],
    totalReceived: 220_000,
    supporterCount: 47,
    createdAt: NOW - 60 * DAY,
  },
];

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").take(1);
    if (existing.length > 0) return { seeded: false, projects: existing.length };

    const ids: Record<string, string> = {};
    for (const p of PROJECTS) {
      const id = await ctx.db.insert("projects", {
        slug: p.slug,
        name: p.name,
        description: p.description,
        githubUrl: p.githubUrl,
        website: p.website,
        walletAddress: p.walletAddress,
        creatorId: undefined,
        creatorWallet: p.walletAddress,
        metadataUri: `ipfs://fundrail-demo/${p.slug}`,
        tags: p.tags,
        status: "active",
        totalReceived: p.totalReceived,
        supporterCount: p.supporterCount,
        createdAt: p.createdAt,
      });
      ids[p.slug] = id;
    }

    // A couple of demo streams so /streams and /activity have life.
    const streamId = await ctx.db.insert("streams", {
      senderId: undefined,
      senderWallet: DEMO_WALLET,
      recipientWallet: DEMO_RECIPIENT,
      token: "USDC",
      startTime: NOW - 30 * DAY,
      endTime: NOW + 30 * DAY,
      rate: Math.floor(500_000 / (60 * DAY)),
      totalAmount: 500_000,
      withdrawnAmount: 210_000,
      pausedDuration: 0,
      status: "active",
      createdAt: NOW - 30 * DAY,
    });

    const splitId = await ctx.db.insert("splits", {
      ownerId: undefined,
      ownerWallet: DEMO_WALLET,
      title: "Core maintainers",
      token: "USDC",
      shares: [
        { walletAddress: DEMO_ALICE, basisPoints: 5_000, claimed: 120_000, pending: 80_000 },
        { walletAddress: DEMO_BOB, basisPoints: 3_000, claimed: 72_000, pending: 48_000 },
        { walletAddress: DEMO_CAROL, basisPoints: 2_000, claimed: 48_000, pending: 32_000 },
      ],
      totalDeposited: 500_000,
      distributedAmount: 400_000,
      pendingAmount: 160_000,
      status: "active",
      createdAt: NOW - 25 * DAY,
    });

    const acts = [
      {
        walletAddress: DEMO_WALLET,
        direction: "out" as const,
        type: "stream_created" as const,
        amount: 500_000,
        token: "USDC",
        counterparty: DEMO_RECIPIENT,
        streamId,
        createdAt: NOW - 30 * DAY,
        note: "Created a USDC stream",
      },
      {
        walletAddress: DEMO_WALLET,
        direction: "in" as const,
        type: "stream_withdraw" as const,
        amount: 210_000,
        token: "USDC",
        counterparty: DEMO_WALLET,
        streamId,
        createdAt: NOW - 5 * DAY,
        note: "Withdrew from stream",
      },
      {
        walletAddress: DEMO_WALLET,
        direction: "out" as const,
        type: "split_deposit" as const,
        amount: 500_000,
        token: "USDC",
        counterparty: "Core maintainers",
        splitId,
        createdAt: NOW - 25 * DAY,
        note: 'Deposited into "Core maintainers"',
      },
      {
        walletAddress: DEMO_WALLET,
        direction: "in" as const,
        type: "split_claim" as const,
        amount: 120_000,
        token: "USDC",
        counterparty: "Core maintainers",
        splitId,
        createdAt: NOW - 3 * DAY,
        note: 'Claimed from "Core maintainers"',
      },
      {
        walletAddress: DEMO_WALLET,
        direction: "out" as const,
        type: "donation" as const,
        amount: 50_000,
        token: "USDC",
        counterparty: "soroban-sdk-rs",
        projectId: ids["soroban-sdk-rs"],
        createdAt: NOW - 2 * DAY,
        note: "Donated to soroban-sdk-rs",
      },
    ];
    for (const a of acts) {
      await ctx.db.insert("activities", {
        userId: undefined,
        walletAddress: a.walletAddress,
        direction: a.direction,
        type: a.type,
        amount: a.amount,
        token: a.token,
        counterparty: a.counterparty,
        projectId: a.projectId as never,
        streamId: a.streamId as never,
        splitId: a.splitId as never,
        createdAt: a.createdAt,
        note: a.note,
      });
    }

    return { seeded: true, projects: PROJECTS.length };
  },
});
