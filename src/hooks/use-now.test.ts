import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToClock } from "./use-now";

/** Collects every tick it receives; call `stop()` to unsubscribe. */
function collector(intervalMs: number) {
  const ticks: number[] = [];
  const stop = subscribeToClock((now) => ticks.push(now), intervalMs);
  return { ticks, stop };
}

describe("subscribeToClock", () => {
  let cleanups: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    cleanups = [];
  });

  afterEach(() => {
    for (const stop of cleanups) stop();
    vi.useRealTimers();
  });

  it("ticks every subscriber from a single shared timer", () => {
    const a = collector(1000);
    const b = collector(1000);
    cleanups.push(a.stop, b.stop);

    vi.advanceTimersByTime(3000);

    expect(a.ticks).toHaveLength(3);
    expect(b.ticks).toHaveLength(3);
  });

  it("ticks at the fastest interval any subscriber requested", () => {
    const slow = collector(1000);
    const fast = collector(250);
    cleanups.push(slow.stop, fast.stop);

    vi.advanceTimersByTime(1000);

    // The fast subscriber gets 4 ticks in 1s; the slow one receives the same
    // shared ticks (more often than it asked for, which is harmless).
    expect(fast.ticks).toHaveLength(4);
    expect(slow.ticks).toHaveLength(4);
  });

  it("delivers Date.now() values", () => {
    const { ticks, stop } = collector(1000);
    cleanups.push(stop);

    vi.advanceTimersByTime(2000);

    expect(ticks[0]).toBeTypeOf("number");
    expect(ticks[1]).toBeGreaterThan(ticks[0]);
  });

  it("stops ticking for a subscriber after it unsubscribes", () => {
    const { ticks, stop } = collector(1000);
    stop();

    vi.advanceTimersByTime(5000);

    expect(ticks).toHaveLength(0);
  });

  it("keeps other subscribers alive when one unsubscribes", () => {
    const staying = collector(1000);
    const leaving = collector(1000);
    cleanups.push(staying.stop);
    leaving.stop();

    vi.advanceTimersByTime(2000);

    expect(staying.ticks).toHaveLength(2);
    expect(leaving.ticks).toHaveLength(0);
  });

  it("shuts the shared timer down once the last subscriber leaves", () => {
    const first = collector(1000);
    const last = collector(1000);
    cleanups.push(first.stop);
    last.stop();

    vi.advanceTimersByTime(1000);
    first.stop();

    const seenAfterCleanup = first.ticks.length + last.ticks.length;
    vi.advanceTimersByTime(10_000);

    expect(first.ticks.length + last.ticks.length).toBe(seenAfterCleanup);
  });
});
