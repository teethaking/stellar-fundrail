import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { shortAddress } from "@/lib/stellar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Copy, LogOut, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { wallet, connecting, error, connectFreighter, connectDemo, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const handleFreighter = async () => {
    try {
      await connectFreighter();
      toast.success("Wallet connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect wallet");
    }
  };

  const handleDemo = async () => {
    try {
      await connectDemo();
      toast.success("Demo wallet connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect demo wallet");
    }
  };

  if (!wallet) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className="gap-2 border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100"
            disabled={connecting}
          >
            <Wallet className="size-4" />
            {connecting ? "Connecting…" : "Connect Wallet"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Connect a Stellar wallet (Testnet)
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleFreighter} className="cursor-pointer gap-3 py-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-300">
              <Wallet className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">Freighter</span>
              <span className="text-xs text-muted-foreground">
                Browser extension wallet for Stellar
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDemo} className="cursor-pointer gap-3 py-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-amber-400/15 text-amber-300">
              <Zap className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">Demo wallet</span>
              <span className="text-xs text-muted-foreground">
                No extension needed — explore with sample funds
              </span>
            </span>
          </DropdownMenuItem>
          {error && <p className="px-3 pb-2 pt-1 text-xs text-red-400">{error}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="gap-2 font-mono text-xs"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          {shortAddress(wallet.address)}
          <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
            {wallet.networkName}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-mono text-xs text-muted-foreground break-all">
          {wallet.address}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer gap-2">
          <Copy className="size-4" />
          {copied ? "Copied!" : "Copy address"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect} className="cursor-pointer gap-2 text-red-400 focus:text-red-400">
          <LogOut className="size-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
