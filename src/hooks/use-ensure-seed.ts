import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

let seededThisSession = false;

/** Seeds the demo project registry once per browser session. */
export function useEnsureSeed() {
  const seed = useMutation(api.seed.seedDemoData);
  const fired = useRef(false);

  useEffect(() => {
    if (seededThisSession || fired.current) return;
    fired.current = true;
    seededThisSession = true;
    seed()
      .then(() => undefined)
      .catch((e) => console.warn("[FundRail] demo seed failed:", e));
  }, [seed]);
}
