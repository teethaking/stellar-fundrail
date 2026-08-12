import { describe, expect, it } from "vitest";
import {
  accruedAmount,
  claimableAmount,
  effectiveNow,
  formatRatePerDay,
  msRemaining,
  rateFromDraft,
  streamProgress,
  type StreamLike,
} from "./stream-math";

/** Active stream: 10 units/ms over 100_000 ms (1,000,000 total). */
function basic(overrides: Partial<StreamLike> = {}): StreamLike {
  return {
    startTime: 0,
    endTime: 100_000,
    rate: 10,
    totalAmount: 1_000_000,
    withdrawnAmount: 0,
    pausedDuration: 0,
    status: "active",
    ...overrides,
  };
}

describe("effectiveNow", () => {
  it("returns the pause timestamp while paused", () => {
    const stream = basic({ status: "paused", lastPausedAt: 20_000 });
    expect(effectiveNow(stream, 80_000)).toBe(20_000);
  });

  it("returns the wall clock when not paused", () => {
    expect(effectiveNow(basic(), 80_000)).toBe(80_000);
    expect(effectiveNow(basic({ status: "cancelled" }), 80_000)).toBe(80_000);
  });
});

describe("accruedAmount", () => {
  it("accrues linearly at the per-ms rate", () => {
    expect(accruedAmount(basic(), 50_000)).toBe(500_000);
  });

  it("is zero before the start time", () => {
    expect(accruedAmount(basic(), 0)).toBe(0);
  });

  it("is capped at the total amount after the end time", () => {
    expect(accruedAmount(basic(), 200_000)).toBe(1_000_000);
    expect(accruedAmount(basic(), 100_000)).toBe(1_000_000);
  });

  it("freezes while paused", () => {
    const paused = basic({ status: "paused", lastPausedAt: 20_000 });
    expect(accruedAmount(paused, 80_000)).toBe(200_000);
  });

  it("folds paused duration back into elapsed time after resume", () => {
    const resumed = basic({ pausedDuration: 10_000 });
    expect(accruedAmount(resumed, 90_000)).toBe(800_000);
  });

  it("never goes negative for cancelled/expired streams", () => {
    expect(accruedAmount(basic({ status: "cancelled" }), 50_000)).toBe(500_000);
  });
});

describe("claimableAmount", () => {
  it("is accrued minus withdrawn", () => {
    const stream = basic({ withdrawnAmount: 300_000 });
    expect(claimableAmount(stream, 50_000)).toBe(200_000);
  });

  it("is never negative", () => {
    const stream = basic({ withdrawnAmount: 900_000 });
    expect(claimableAmount(stream, 50_000)).toBe(0);
  });
});

describe("streamProgress", () => {
  it("returns the accrued fraction", () => {
    expect(streamProgress(basic(), 50_000)).toBe(0.5);
    expect(streamProgress(basic(), 0)).toBe(0);
    expect(streamProgress(basic(), 1_000_000)).toBe(1);
  });

  it("handles zero totals", () => {
    expect(streamProgress(basic({ totalAmount: 0 }), 50_000)).toBe(0);
  });
});

describe("msRemaining", () => {
  it("counts down to the end time", () => {
    expect(msRemaining(basic(), 30_000)).toBe(70_000);
    expect(msRemaining(basic(), 200_000)).toBe(0);
  });

  it("is zero for cancelled streams", () => {
    expect(msRemaining(basic({ status: "cancelled" }), 30_000)).toBe(0);
  });
});

describe("rateFromDraft", () => {
  it("derives the per-ms rate from amount and duration", () => {
    expect(rateFromDraft({ totalAmount: 1_000_000, startTime: 0, endTime: 100_000 })).toBe(10);
  });

  it("floors fractional rates", () => {
    expect(rateFromDraft({ totalAmount: 999, startTime: 0, endTime: 100 })).toBe(9);
  });

  it("returns 0 for a degenerate window", () => {
    expect(rateFromDraft({ totalAmount: 1_000, startTime: 100, endTime: 100 })).toBe(0);
  });
});

describe("formatRatePerDay", () => {
  it("scales a per-ms rate to a per-day figure", () => {
    expect(formatRatePerDay(10, "USDC")).toBe("864,000,000 USDC/day");
  });
});
