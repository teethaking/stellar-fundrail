/**
 * Stream math shared by the frontend and the Convex backend.
 *
 * This mirrors the Rust `funding_stream` Soroban contract (see contracts/)
 * so the simulated chain behaves identically to the on-chain implementation:
 *
 *   accrued(now) = rate * max(0, now - startTime - pausedDuration)
 *   claimable    = min(accrued, totalAmount) - withdrawnAmount
 *
 * While a stream is paused, accrual is frozen: `now` is clamped to
 * `lastPausedAt`. On resume, the pause is folded into `pausedDuration`.
 *
 * Amounts are integers in the token's base units. `rate` is base units per
 * millisecond so durations down to the second work without rounding issues.
 */

export type StreamStatus = "active" | "paused" | "cancelled" | "completed";

export interface StreamLike {
  startTime: number;
  endTime: number;
  rate: number;
  totalAmount: number;
  withdrawnAmount: number;
  pausedDuration: number;
  lastPausedAt?: number;
  status: StreamStatus;
}

/** Effective "now" for accrual purposes (frozen while paused). */
export function effectiveNow(stream: StreamLike, now: number): number {
  if (stream.status === "paused" && stream.lastPausedAt != null) {
    return stream.lastPausedAt;
  }
  return now;
}

/** How much has accrued to the recipient up to `now` (cap = totalAmount). */
export function accruedAmount(stream: StreamLike, now: number): number {
  const clock = effectiveNow(stream, now);
  const capped = Math.min(clock, stream.endTime);
  const elapsed = Math.max(0, capped - stream.startTime - stream.pausedDuration);
  return Math.min(stream.totalAmount, Math.floor(stream.rate * elapsed));
}

/** Amount the recipient can withdraw right now. */
export function claimableAmount(stream: StreamLike, now: number): number {
  return Math.max(0, accruedAmount(stream, now) - stream.withdrawnAmount);
}

/** Estimated progress of a stream (0..1) for progress bars. */
export function streamProgress(stream: StreamLike, now: number): number {
  if (stream.totalAmount === 0) return 0;
  return Math.min(1, accruedAmount(stream, now) / stream.totalAmount);
}

/** ms until the stream completes (0 if already done or cancelled). */
export function msRemaining(stream: StreamLike, now: number): number {
  if (stream.status === "cancelled") return 0;
  return Math.max(0, stream.endTime - effectiveNow(stream, now));
}

export interface StreamDraft {
  totalAmount: number;
  startTime: number;
  endTime: number;
}

/** Derive the rate for a stream from a total amount and a duration window. */
export function rateFromDraft(draft: StreamDraft): number {
  const duration = draft.endTime - draft.startTime;
  if (duration <= 0) return 0;
  return Math.floor(draft.totalAmount / duration);
}

/** Human formatting of a rate (base units/ms) into "X / day". */
export function formatRatePerDay(rate: number, token: string): string {
  const perDay = rate * 86_400_000;
  return `${perDay.toLocaleString()} ${token}/day`;
}
