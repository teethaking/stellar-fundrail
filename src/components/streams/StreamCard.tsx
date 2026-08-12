import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNow } from "@/hooks/use-now";
import {
  accruedAmount,
  claimableAmount,
  formatRatePerDay,
  msRemaining,
  streamProgress,
  type StreamStatus,
} from "@/lib/stream-math";
import { formatDuration, formatUnits, shortAddress, simulateTxHash } from "@/lib/stellar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square, Wallet } from "lucide-react";
import { toast } from "sonner";

export interface StreamLive {
  _id: string;
  senderWallet: string;
  recipientWallet: string;
  token: string;
  startTime: number;
  endTime: number;
  rate: number;
  totalAmount: number;
  withdrawnAmount: number;
  pausedDuration: number;
  lastPausedAt?: number;
  status: StreamStatus;
  createdAt: number;
  claimable?: number;
  accrued?: number;
}

const STATUS_STYLE: Record<StreamStatus, string> = {
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  paused: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  cancelled: "border-red-400/30 bg-red-400/10 text-red-300",
  completed: "border-border bg-white/5 text-muted-foreground",
};

export function StreamCard({ stream, wallet }: { stream: StreamLive; wallet: string | null }) {
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);

  const pause = useMutation(api.streams.pauseStream);
  const resume = useMutation(api.streams.resumeStream);
  const cancel = useMutation(api.streams.cancelStream);
  const withdraw = useMutation(api.streams.withdrawStream);

  const accrued = accruedAmount(stream, now);
  const claimable = claimableAmount(stream, now);
  const progress = streamProgress(stream, now);
  const remaining = msRemaining(stream, now);

  const isSender = wallet != null && wallet === stream.senderWallet;
  const isRecipient = wallet != null && wallet === stream.recipientWallet;

  const run = async (label: "pause" | "resume" | "cancel" | "withdraw") => {
    if (!wallet) return;
    setBusy(label);
    try {
      switch (label) {
        case "withdraw":
          await withdraw({ id: stream._id as never, walletAddress: wallet, txHash: simulateTxHash("wd") });
          break;
        case "pause":
          await pause({ id: stream._id as never, walletAddress: wallet });
          break;
        case "resume":
          await resume({ id: stream._id as never, walletAddress: wallet });
          break;
        case "cancel":
          await cancel({ id: stream._id as never, walletAddress: wallet });
          break;
      }
      toast.success(label === "withdraw" ? "Withdrawn" : `Stream ${label}d`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const showActions = isSender || isRecipient;

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-5">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            {stream.status === "active" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span
              className={`relative inline-flex size-2 rounded-full ${
                stream.status === "active"
                  ? "bg-emerald-400"
                  : stream.status === "paused"
                    ? "bg-amber-400"
                    : stream.status === "cancelled"
                      ? "bg-red-400"
                      : "bg-muted-foreground"
              }`}
            />
          </span>
          <span className="font-mono text-sm font-semibold">{stream.token}</span>
          <Badge variant="secondary" className={`font-mono text-[10px] ${STATUS_STYLE[stream.status]}`}>
            {stream.status}
          </Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {formatUnits(stream.rate * 86_400_000)} {stream.token}/day
        </span>
      </div>

      {/* rail */}
      <div className="mt-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm">{shortAddress(stream.senderWallet, 6)}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">Sender</p>
        </div>
        <div className="flex flex-1 items-center gap-1 px-1">
          <span className="h-px flex-1 bg-border" />
          <span className={`size-1.5 rounded-full ${stream.status === "active" ? "bg-cyan-300" : "bg-border"}`} />
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate font-mono text-sm">{shortAddress(stream.recipientWallet, 6)}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">Recipient</p>
        </div>
      </div>

      {/* amounts */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Accrued</p>
          <p className="mt-1 font-mono text-lg font-semibold text-cyan-200">
            {formatUnits(accrued)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            of {formatUnits(stream.totalAmount)} {stream.token}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isRecipient ? "Claimable now" : "Withdrawn"}
          </p>
          <p className={`mt-1 font-mono text-lg font-semibold ${claimable > 0 ? "text-emerald-300" : ""}`}>
            {formatUnits(isRecipient ? claimable : stream.withdrawnAmount)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {isRecipient && claimable > 0 ? "ready to withdraw" : stream.token}
          </p>
        </div>
      </div>

      {/* progress */}
      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>
            {stream.status === "paused"
              ? `paused ${formatDuration(now - (stream.lastPausedAt ?? now))}`
              : stream.status === "cancelled"
                ? "cancelled"
                : stream.status === "completed"
                  ? "completed"
                  : `${formatDuration(remaining)} left`}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>

      {/* actions */}
      {showActions && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-4">
          {isSender && stream.status === "active" && (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy != null} onClick={() => run("pause")}>
              <Pause className="size-3.5" /> Pause
            </Button>
          )}
          {isSender && stream.status === "paused" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-emerald-300" disabled={busy != null} onClick={() => run("resume")}>
              <Play className="size-3.5" /> Resume
            </Button>
          )}
          {isSender && (stream.status === "active" || stream.status === "paused") && (
            <Button size="sm" variant="outline" className="gap-1.5 text-red-400 hover:text-red-300" disabled={busy != null} onClick={() => run("cancel")}>
              <Square className="size-3.5" /> Cancel
            </Button>
          )}
          {isRecipient && claimable > 0 && stream.status !== "completed" && (
            <Button
              size="sm"
              className="ml-auto gap-1.5 bg-emerald-400 font-medium text-[#04141B] hover:bg-emerald-300"
              disabled={busy != null}
              onClick={() => run("withdraw")}
            >
              <Wallet className="size-3.5" /> Withdraw {formatUnits(claimable)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
