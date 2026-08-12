import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useWallet } from "@/hooks/use-wallet";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { formatUnits, shortAddress, timeAgo } from "@/lib/stellar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  ArrowDownLeft,
  ArrowUpRight,
  GitFork,
  HandCoins,
  Heart,
  History,
  Landmark,
  Loader2,
  Pause,
  Play,
  Radio,
  Split,
  Square,
  TrendingUp,
} from "lucide-react";

type ActivityDoc = Doc<"activities">;

const TYPE_META: Record<string, { label: string; icon: typeof Heart }> = {
  donation: { label: "Donation", icon: Heart },
  project_registered: { label: "Project registered", icon: Landmark },
  project_updated: { label: "Project updated", icon: GitFork },
  stream_created: { label: "Stream created", icon: Radio },
  stream_withdraw: { label: "Stream withdrawal", icon: HandCoins },
  stream_paused: { label: "Stream paused", icon: Pause },
  stream_resumed: { label: "Stream resumed", icon: Play },
  stream_cancelled: { label: "Stream cancelled", icon: Square },
  split_created: { label: "Split created", icon: Split },
  split_deposit: { label: "Split deposit", icon: TrendingUp },
  split_distribute: { label: "Split distribution", icon: Split },
  split_claim: { label: "Split claim", icon: HandCoins },
};

const TYPE_KEYS = Object.keys(TYPE_META);

export default function Activity() {
  const { wallet } = useWallet();
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [type, setType] = useState<string>("all");

  // Wallet-scoped ledger when connected; otherwise the global recent feed.
  const activities = useQuery(
    api.activities.list,
    wallet ? { walletAddress: wallet.address, limit: 200 } : "skip",
  );
  const global = useQuery(api.activities.recent, wallet ? "skip" : { limit: 50 });
  const rows = wallet ? activities : global;

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    return rows.filter((a) => {
      if (direction !== "all" && a.direction !== direction) return false;
      if (type !== "all" && a.type !== type) return false;
      return true;
    });
  }, [rows, direction, type]);

  return (
    <SiteLayout wide>
      <PageHeader
        eyebrow="Public ledger"
        title={wallet ? "Your activity" : "Network activity"}
        description={
          wallet
            ? "Every transaction touching your wallet — donations, streams, splits — in one place."
            : "The live public ledger of every funding event on FundRail. Connect a wallet to filter by yours."
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!wallet && (
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDirection("all")}>
              <History className="size-3.5" /> Viewing global feed
            </Button>
            <span className="text-xs text-muted-foreground">Connect a wallet to see only your transactions.</span>
          </>
        )}
        {wallet && (
          <>
            <div className="flex rounded-lg border border-border/70 p-0.5">
              {(["all", "in", "out"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`cursor-pointer rounded-md px-3 py-1.5 font-mono text-xs capitalize transition-colors ${
                    direction === d
                      ? "bg-cyan-400/10 text-cyan-200"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d === "all" ? "all" : d === "in" ? "received ↓" : "sent ↑"}
                </button>
              ))}
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-44 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all types</SelectItem>
                {TYPE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {TYPE_META[k].label.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <ActivityList rows={filtered} wallet={wallet?.address ?? null} />
    </SiteLayout>
  );
}

function ActivityList({ rows, wallet }: { rows: ActivityDoc[] | undefined; wallet: string | null }) {
  if (rows === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading ledger…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <Empty className="min-h-72 border-border/60">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Nothing here yet</EmptyTitle>
          <EmptyDescription>
            {wallet
              ? "No transactions touch this wallet yet. Start a stream, make a donation, or create a split."
              : "The ledger is empty — seed data is still warming up."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/70 bg-card/40">
      {rows.map((a) => {
        const meta = TYPE_META[a.type] ?? { label: a.type.replace(/_/g, " "), icon: History };
        const Icon = meta.icon;
        return (
          <div key={a._id} className="flex items-start gap-3 px-4 py-3.5 sm:items-center">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                a.direction === "in" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium capitalize">{meta.label}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {a.note ?? a.type.replace(/_/g, " ")}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground/80">
                <span>{timeAgo(a.createdAt)}</span>
                {a.counterparty && (
                  <span className="flex items-center gap-1">
                    {a.direction === "in" ? (
                      <ArrowDownLeft className="size-3 text-emerald-400/70" />
                    ) : (
                      <ArrowUpRight className="size-3 text-rose-400/70" />
                    )}
                    {shortAddress(a.counterparty, 6)}
                  </span>
                )}
                {a.txHash && <span className="truncate">{a.txHash}</span>}
              </p>
            </div>
            {a.amount != null && (
              <div className="shrink-0 text-right">
                <p className={`font-mono text-sm font-semibold ${a.direction === "in" ? "text-emerald-300" : "text-rose-300"}`}>
                  {a.direction === "in" ? "+" : "−"}{formatUnits(a.amount)}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">{a.token ?? "—"}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
