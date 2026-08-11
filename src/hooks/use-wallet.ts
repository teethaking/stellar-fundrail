import { useCallback, useEffect, useState } from "react";
import {
  connectDemoWallet,
  connectFreighter,
  type WalletState,
} from "@/lib/stellar";

const STORAGE_KEY = "fundrail.wallet";

type WalletHook = {
  wallet: WalletState | null;
  connecting: boolean;
  error: string | null;
  connectFreighter: () => Promise<WalletState>;
  connectDemo: () => Promise<WalletState>;
  disconnect: () => void;
};

function readStored(): WalletState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletState;
    if (parsed?.address && /^G[A-Z2-7]{55}$/.test(parsed.address)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function useWallet(): WalletHook {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWallet(readStored());
  }, []);

  const persist = useCallback((w: WalletState) => {
    setWallet(w);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
    } catch {
      // storage unavailable — keep in-memory state
    }
  }, []);

  const connectFreighterFn = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const w = await connectFreighter();
      persist(w);
      return w;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [persist]);

  const connectDemo = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const w = await connectDemoWallet();
      persist(w);
      return w;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect demo wallet");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [persist]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    wallet,
    connecting,
    error,
    connectFreighter: connectFreighterFn,
    connectDemo,
    disconnect,
  };
}
