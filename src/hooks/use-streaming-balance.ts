import { useMemo } from "react";
import { useNow } from "./use-now";
import {
  accruedAmount,
  claimableAmount,
  msRemaining,
  streamProgress,
  type StreamLike,
} from "@/lib/stream-math";

/**
 * Live snapshot of a funding stream's balances.
 *
 * All amounts are integer token base units (same convention as
 * `@/lib/stream-math`, which mirrors the `funding_stream` contract).
 */
export interface StreamingBalance {
  /** Timestamp the snapshot was computed at. The web app runs against a
   *  Convex simulation of the chain, so this is the wall clock — the
   *  on-chain counterpart is `env.ledger().timestamp()`. */
  now: number;
  /** Base units accrued to the recipient so far (capped at `totalAmount`). */
  vested: number;
  /** Accrued minus withdrawn — what the recipient can withdraw right now. */
  claimable: number;
  /** Accrued fraction of `totalAmount`, 0..1 (for progress bars). */
  progress: number;
  /** Milliseconds of accrual left (0 once ended or cancelled). */
  remainingMs: number;
  /** Base units per second currently flowing (0 when paused, cancelled,
   *  completed, or before the start time). */
  flowPerSecond: number;
}

/**
 * Reusable live counter for a funding stream.
 *
 * Recomputes the vested/claimable balance from `startTime`, `endTime`,
 * `rate` and the current timestamp on every clock tick (default 1s),
 * freezing accrual while the stream is paused and capping it at
 * `totalAmount` — the same rules as the contract. The clock is shared by
 * all consumers (see `useNow`), so many counters on one page cost a single
 * timer and one small render per tick; pair with `useAnimatedNumber` to
 * interpolate between ticks for smooth motion.
 */
export function useStreamingBalance(
  stream: StreamLike,
  intervalMs = 1000,
): StreamingBalance {
  const now = useNow(intervalMs);

  return useMemo(() => {
    const flowing =
      stream.status === "active" &&
      now >= stream.startTime &&
      now < stream.endTime;
    return {
      now,
      vested: accruedAmount(stream, now),
      claimable: claimableAmount(stream, now),
      progress: streamProgress(stream, now),
      remainingMs: msRemaining(stream, now),
      flowPerSecond: flowing ? stream.rate * 1000 : 0,
    };
  }, [stream, now]);
}
