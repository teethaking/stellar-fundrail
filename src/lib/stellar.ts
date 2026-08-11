import { getAddress, getNetworkDetails, isConnected } from "@stellar/freighter-api";

/** Stellar Testnet configuration. */
export const STELLAR_NETWORK = {
  name: "Testnet",
  passphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
} as const;

/** Circle's testnet USDC issuer. */
export const USDC_TESTNET = {
  symbol: "USDC",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3ZNOJLGWRY5T7V3UZ5G",
  decimals: 7,
} as const;

export const SUPPORTED_TOKENS = ["USDC", "XLM"] as const;

/** Public demo wallets used when Freighter isn't installed. */
export const DEMO_WALLET = "GD3KYNFZVN2BQZH6JBGM3T47RKUUDAQYZDEIFQ6X5LZ7UVVWO57XCAJQ";
export const DEMO_RECIPIENT = "GDK72JBRC75GSQWHVICSWANTEEVCRHFL2OKGK545WANDXLR547QHS3ZE";
export const DEMO_ALICE = "GCQX5JZ3EY7V3EGW24EMQ6MH2XJ7D4PZNQTTQPPVSFNI6XWBEPKTX7B4";
export const DEMO_BOB = "GD355TIVGVDXZGSZA2CPEUDMA5DXKATLM262TJ22XQZ2AXPXK446MAG4";
export const DEMO_CAROL = "GDV53QVIL3JTTUR676EZ34ZHCYTZXJJPCAZVIGP4VVJ4YUYAL3KBT45R";

export type WalletSource = "freighter" | "demo";

export interface WalletState {
  address: string;
  networkName: string;
  passphrase: string;
  source: WalletSource;
}

export function shortAddress(address: string, length = 4): string {
  if (!address) return "";
  return address.length <= length * 2 + 3
    ? address
    : `${address.slice(0, length + 1)}…${address.slice(-length)}`;
}

/** Validate a Stellar public key (StrKey ed25519, `G...`). */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

/** base units (7 decimals) -> display string like "1,250.00". */
export function formatUnits(units: number, decimals = USDC_TESTNET.decimals): string {
  const value = units / 10 ** decimals;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: Math.min(decimals, 4),
    minimumFractionDigits: 0,
  });
}

/** base units -> compact string like "2.45M USDC". */
export function formatUnitsCompact(units: number, decimals = USDC_TESTNET.decimals): string {
  const value = units / 10 ** decimals;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatUnits(units, decimals);
}

export function formatAmountWithToken(units: number, token: string): string {
  return `${formatUnits(units)} ${token}`;
}

/** "12.50" (display) -> base units. */
export function parseUnits(display: string, decimals = USDC_TESTNET.decimals): number {
  const n = Number(display.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * 10 ** decimals);
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Deterministic-looking pseudo hash for simulated chain submissions. */
export function simulateTxHash(prefix = "sim"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}${rand}`;
}

/** Connect to the Freighter browser extension. Throws a friendly error if it
 *  is unavailable or the user rejects access. */
export async function connectFreighter(): Promise<WalletState> {
  if (typeof window === "undefined") throw new Error("Wallet connection requires a browser");

  const connected = await isConnected();
  if (!connected) {
    throw new Error(
      "Freighter is not connected. Install the Freighter extension, unlock it, then try again.",
    );
  }

  const { address, error } = await getAddress();
  if (error || !address) {
    throw new Error(error?.message ?? "Could not read your wallet address from Freighter");
  }

  const details = await getNetworkDetails();
  const networkName = details.network || "Testnet";
  const passphrase = details.networkPassphrase || STELLAR_NETWORK.passphrase;

  return { address, networkName, passphrase, source: "freighter" };
}

export async function connectDemoWallet(): Promise<WalletState> {
  return {
    address: DEMO_WALLET,
    networkName: "Testnet (demo)",
    passphrase: STELLAR_NETWORK.passphrase,
    source: "demo",
  };
}
