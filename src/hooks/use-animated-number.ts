import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Smoothly interpolates between numeric values.
 * When reduced motion is preferred, snaps immediately.
 * Duration defaults to 600ms with ease-out curve.
 */
export function useAnimatedNumber(
  target: number,
  durationMs = 600,
): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    // If target hasn't changed, skip
    if (Math.abs(target - display) < 0.001) return;

    fromRef.current = display;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - (startRef.current ?? now);
      const t = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const value = fromRef.current + (target - fromRef.current) * ease;
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return reduced ? target : display;
}
