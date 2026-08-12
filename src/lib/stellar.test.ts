import { describe, expect, it } from "vitest";
import {
  DEMO_RECIPIENT,
  DEMO_WALLET,
  formatAmountWithToken,
  formatDate,
  formatDateTime,
  formatDuration,
  formatUnits,
  formatUnitsCompact,
  isValidStellarAddress,
  parseUnits,
  shortAddress,
  timeAgo,
} from "./stellar";

describe("formatUnits / parseUnits", () => {
  it("converts base units to a display string", () => {
    expect(formatUnits(125_000_000)).toBe("12.5");
    expect(formatUnits(2_500_000)).toBe("0.25");
    expect(formatUnits(1_000_000_000_000)).toBe("100,000");
  });

  it("round-trips a display amount back to base units", () => {
    expect(parseUnits("12.5")).toBe(125_000_000);
    expect(parseUnits("0.25")).toBe(2_500_000);
    expect(parseUnits("1,234.5")).toBe(12_345_000_000);
  });

  it("rejects malformed amounts", () => {
    expect(() => parseUnits("abc")).toThrow();
    expect(() => parseUnits("-5")).toThrow();
    expect(() => parseUnits("NaN")).toThrow();
  });
});

describe("formatUnitsCompact", () => {
  it("switches to M / K suffixes for large values", () => {
    expect(formatUnitsCompact(2_500_000)).toBe("0.25");
    expect(formatUnitsCompact(25_000_000)).toBe("2.5");
    expect(formatUnitsCompact(25_000_000_000)).toBe("2,500");
    expect(formatUnitsCompact(250_000_000_000)).toBe("25.0K");
    expect(formatUnitsCompact(2_500_000_000_000)).toBe("250.0K");
    expect(formatUnitsCompact(25_000_000_000_000)).toBe("2.50M");
  });
});

describe("formatAmountWithToken", () => {
  it("appends the token symbol", () => {
    expect(formatAmountWithToken(125_000_000, "USDC")).toBe("12.5 USDC");
  });
});

describe("isValidStellarAddress", () => {
  it("accepts valid G-prefixed ed25519 public keys", () => {
    expect(isValidStellarAddress(DEMO_WALLET)).toBe(true);
    expect(isValidStellarAddress(DEMO_RECIPIENT)).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress("G")).toBe(false);
    expect(isValidStellarAddress("GABC123")).toBe(false);
    expect(isValidStellarAddress(DEMO_WALLET.toLowerCase())).toBe(false);
    // 57 characters
    expect(isValidStellarAddress(`G${DEMO_WALLET.slice(1)}A`)).toBe(false);
  });
});

describe("shortAddress", () => {
  it("truncates long addresses with an ellipsis", () => {
    expect(shortAddress(DEMO_WALLET)).toBe("GD3KY…CAJQ");
    expect(shortAddress(DEMO_WALLET, 6)).toBe("GD3KYNF…7XCAJQ");
  });

  it("leaves short strings untouched", () => {
    expect(shortAddress("GABC")).toBe("GABC");
  });
});

describe("formatDuration", () => {
  it("formats day/hour windows", () => {
    expect(formatDuration(2 * 86_400_000 + 5 * 3_600_000)).toBe("2d 5h");
  });

  it("formats hour/minute windows", () => {
    expect(formatDuration(5_400_000)).toBe("1h 30m");
  });

  it("formats minutes and handles ended streams", () => {
    expect(formatDuration(2_700_000)).toBe("45m");
    expect(formatDuration(0)).toBe("ended");
    expect(formatDuration(-1)).toBe("ended");
  });
});

describe("timeAgo", () => {
  const now = Date.now();
  it("classifies recent timestamps", () => {
    expect(timeAgo(now - 30_000)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3_600_000)).toBe("3h ago");
    expect(timeAgo(now - 2 * 86_400_000)).toBe("2d ago");
    expect(timeAgo(now - 40 * 86_400_000)).toBe("1mo ago");
    expect(timeAgo(now - 400 * 86_400_000)).toBe("1y ago");
  });
});

describe("formatDate / formatDateTime", () => {
  it("renders a date in en-US", () => {
    const ts = new Date("2024-06-15T12:00:00Z").getTime();
    expect(formatDate(ts)).toContain("Jun 15, 2024");
    expect(formatDateTime(ts)).toContain("Jun 15");
  });
});
