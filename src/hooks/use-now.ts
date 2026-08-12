import { useEffect, useState } from "react";

/** A `Date.now()` value that re-renders on an interval (default 1s).
 *  Used for live stream accrual counters. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return now;
}
