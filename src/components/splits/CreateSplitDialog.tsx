import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/hooks/use-wallet";
import { simulateTxHash } from "@/lib/stellar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SplitShareEditor, type ShareRow } from "@/components/splits/SplitShareEditor";
import { Split, Wallet } from "lucide-react";
import { toast } from "sonner";

export function CreateSplitDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { wallet } = useWallet();
  const createSplit = useMutation(api.splits.createSplit);

  const [title, setTitle] = useState("");
  const [token, setToken] = useState("USDC");
  const [shares, setShares] = useState<ShareRow[]>([
    { walletAddress: "", basisPoints: 5_000 },
    { walletAddress: "", basisPoints: 5_000 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setToken("USDC");
    setShares([
      { walletAddress: "", basisPoints: 5_000 },
      { walletAddress: "", basisPoints: 5_000 },
    ]);
    setError(null);
  };

  const handleClose = (value: boolean) => {
    if (!submitting) onOpenChange(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      setError("Connect a wallet first — use Freighter or the demo wallet.");
      return;
    }
    setError(null);

    const cleaned = shares
      .map((s) => ({ walletAddress: s.walletAddress.trim(), basisPoints: s.basisPoints }))
      .filter((s) => s.walletAddress.length > 0);

    if (cleaned.length < 2) {
      setError("Add at least two recipients");
      return;
    }
    const total = cleaned.reduce((sum, s) => sum + s.basisPoints, 0);
    if (total !== 10_000) {
      setError(`Shares must add up to exactly 100% (currently ${(total / 100).toFixed(2)}%)`);
      return;
    }

    setSubmitting(true);
    try {
      const id = await createSplit({
        ownerWallet: wallet.address,
        title: title.trim() || "Untitled split",
        token,
        shares: cleaned,
        txHash: simulateTxHash("split"),
      });
      toast.success("Split created", { description: "Deposit funds to start distributing." });
      reset();
      onOpenChange(false);
      onCreated?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create split");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a payment split</DialogTitle>
          <DialogDescription>
            One deposit fans out to every recipient proportionally. Shares must total exactly
            100% — validated on-chain.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="split-title">Title</Label>
              <Input
                id="split-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Core maintainers"
                className="text-sm"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Token</Label>
              <Select value={token} onValueChange={setToken} disabled={submitting}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="XLM">XLM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Recipients</Label>
            <SplitShareEditor shares={shares} onChange={setShares} disabled={submitting} />
          </div>

          {!wallet && (
            <p className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">
              <Wallet className="mt-0.5 size-4 shrink-0" />
              No wallet connected. Connect Freighter or the demo wallet from the navbar first.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !wallet}
              className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
            >
              <Split className="size-4" />
              {submitting ? "Creating…" : "Create split"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
