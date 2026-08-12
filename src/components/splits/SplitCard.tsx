import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/hooks/use-wallet";
import { formatUnits, parseUnits, shortAddress, simulateTxHash } from "@/lib/stellar";
import { Badge } from "@/components/ui/badge";
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
import { SplitShareEditor, type ShareRow } from "@/components/splits/SplitShareEditor";
import { HandCoins, Pencil, Plus, Split, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export interface SplitShare {
  walletAddress: string;
  basisPoints: number;
  claimed: number;
  pending: number;
}

export interface SplitDoc {
  _id: string;
  ownerWallet: string;
  title: string;
  token: string;
  shares: SplitShare[];
  totalDeposited: number;
  distributedAmount: number;
  pendingAmount: number;
  status: "active" | "closed";
  createdAt: number;
}

const BAR_COLORS = ["#22D3EE", "#38BDF8", "#FBBF24", "#34D399", "#A78BFA", "#FB7185"];

export function SplitCard({ split, wallet }: { split: SplitDoc; wallet: string | null }) {
  const deposit = useMutation(api.splits.deposit);
  const distribute = useMutation(api.splits.distribute);
  const claim = useMutation(api.splits.claim);
  const updateSplit = useMutation(api.splits.updateSplit);
  const removeRecipient = useMutation(api.splits.removeRecipient);

  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(split.title);
  const [editShares, setEditShares] = useState<ShareRow[]>(
    split.shares.map((s) => ({ walletAddress: s.walletAddress, basisPoints: s.basisPoints })),
  );

  const isOwner = wallet != null && wallet === split.ownerWallet;
  const myShare = wallet ? split.shares.find((s) => s.walletAddress === wallet) : undefined;
  const allocatable = split.totalDeposited - split.distributedAmount;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      toast.success(
        label === "deposit"
          ? "Deposit recorded"
          : label === "distribute"
            ? "Funds distributed"
            : label === "claim"
              ? "Claimed"
              : "Split updated",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    let units: number;
    try {
      units = parseUnits(amount.trim());
    } catch {
      toast.error("Enter a valid amount");
      return;
    }
    if (units <= 0) {
      toast.error("Deposit must be positive");
      return;
    }
    run("deposit", () =>
      deposit({ id: split._id as never, walletAddress: wallet, amount: units, txHash: simulateTxHash("dep") }),
    );
    setAmount("");
  };

  const handleSaveShares = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    const cleaned = editShares
      .map((s) => ({ walletAddress: s.walletAddress.trim(), basisPoints: s.basisPoints }))
      .filter((s) => s.walletAddress.length > 0);
    if (cleaned.reduce((sum, s) => sum + s.basisPoints, 0) !== 10_000) {
      toast.error("Shares must add up to exactly 100%");
      return;
    }
    await run("update", () =>
      updateSplit({ id: split._id as never, ownerWallet: wallet, title: editTitle.trim() || split.title, shares: cleaned }),
    );
    setEditOpen(false);
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-5">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-400/15 text-amber-300">
            <Split className="size-4" />
          </span>
          <p className="truncate font-mono text-sm font-semibold">{split.title}</p>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {split.token}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="font-mono text-[10px]">
            {split.status}
          </Badge>
          {isOwner && (
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => setEditOpen(true)} aria-label="Edit split">
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deposited</p>
          <p className="mt-1 font-mono text-sm font-semibold">{formatUnits(split.totalDeposited)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Distributed</p>
          <p className="mt-1 font-mono text-sm font-semibold text-cyan-200">{formatUnits(split.distributedAmount)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
          <p className="mt-1 font-mono text-sm font-semibold text-amber-200">{formatUnits(split.pendingAmount)}</p>
        </div>
      </div>

      {/* shares */}
      <div className="mt-5 space-y-3">
        {split.shares.map((s, i) => (
          <div key={s.walletAddress} className="flex items-center gap-3">
            <div className="w-40 min-w-0">
              <p className="truncate font-mono text-xs">
                {s.walletAddress === wallet ? (
                  <span className="text-emerald-300">{shortAddress(s.walletAddress, 5)} (you)</span>
                ) : (
                  shortAddress(s.walletAddress, 5)
                )}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {(s.basisPoints / 100).toFixed(s.basisPoints % 100 === 0 ? 0 : 2)}% · {formatUnits(s.pending)} pending
              </p>
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{ width: `${(s.basisPoints / 100)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
              />
            </div>
            {myShare && myShare.walletAddress === s.walletAddress && s.pending > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-emerald-300"
                disabled={busy != null}
                onClick={() =>
                  run("claim", () =>
                    claim({ id: split._id as never, walletAddress: wallet!, txHash: simulateTxHash("claim") }),
                  )
                }
              >
                <HandCoins className="size-3.5" /> Claim
              </Button>
            )}
            {isOwner && s.pending === 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-red-400"
                disabled={busy != null || split.shares.length === 1}
                onClick={() =>
                  run("remove", () => removeRecipient({ id: split._id as never, ownerWallet: wallet!, walletAddress: s.walletAddress }))
                }
                aria-label={`Remove ${shortAddress(s.walletAddress)}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
        <form onSubmit={handleDeposit} className="flex items-center gap-2">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Deposit ${split.token}…`}
            inputMode="decimal"
            className="h-8 w-40 font-mono text-xs"
          />
          <Button size="sm" variant="outline" type="submit" className="gap-1.5" disabled={busy != null || !wallet}>
            <Plus className="size-3.5" /> Deposit
          </Button>
        </form>
        {isOwner && allocatable > 0 && (
          <Button
            size="sm"
            className="ml-auto gap-1.5 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
            disabled={busy != null}
            onClick={() =>
              run("distribute", () =>
                distribute({ id: split._id as never, walletAddress: wallet!, txHash: simulateTxHash("dist") }),
              )
            }
          >
            <TrendingUp className="size-3.5" /> Distribute {formatUnits(allocatable)}
          </Button>
        )}
      </div>

      {/* edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit split</DialogTitle>
            <DialogDescription>
              Shares can only change while nothing is pending — distribute and claim first.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveShares} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Recipients</Label>
              <SplitShareEditor shares={editShares} onChange={setEditShares} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy != null}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
