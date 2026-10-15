import { useEffect, useState } from "react";

/**
 * Shared wall clock for live counters.
 *
 * Every consumer of `useNow` subscribes to one module-level `setInterval`
 * (running at the fastest interval any subscriber asked for) instead of
 * mounting its own timer, so a page with hundreds of live stream counters
 * still ticks once per interval and each consumer re-renders at most once
 * per tick.
 */
interface ClockSubscriber {
  intervalMs: number;
  notify: (now: number) => void;
}

const subscribers = new Set<ClockSubscriber>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  const now = Date.now();
  for (const sub of subscribers) sub.notify(now);
}

function currentInterval(): number {
  let min = Infinity;
  for (const sub of subscribers) min = Math.min(min, sub.intervalMs);
  return min;
}

function restartTimer() {
  if (timer != null) clearInterval(timer);
  timer = subscribers.size > 0 ? setInterval(tick, currentInterval()) : null;
}

/** Subscribe to the shared clock outside of React. Returns an unsubscribe fn. */
export function subscribeToClock(
  notify: (now: number) => void,
  intervalMs = 1000,
): () => void {
  const sub: ClockSubscriber = { intervalMs, notify };
  subscribers.add(sub);
  restartTimer();
  return () => {
    subscribers.delete(sub);
    restartTimer();
  };
}

/** A `Date.now()` value that re-renders on an interval (default 1s).
 *  Used for live stream accrual counters. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // The initial state above is already a fresh mount-time value; the
    // shared clock keeps it current from here on.
    return subscribeToClock(setNow, intervalMs);
  }, [intervalMs]);

  return now;
}
