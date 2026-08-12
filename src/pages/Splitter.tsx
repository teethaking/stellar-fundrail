import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/hooks/use-wallet";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { WalletGate } from "@/components/wallet/WalletGate";
import { CreateSplitDialog } from "@/components/splits/CreateSplitDialog";
import { SplitCard, type SplitDoc } from "@/components/splits/SplitCard";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatUnits } from "@/lib/stellar";
import { Loader2, Plus, Split } from "lucide-react";

export default function Splitter() {
  const { wallet } = useWallet();
  const [createOpen, setCreateOpen] = useState(false);

  const splits = useQuery(
    api.splits.list,
    wallet ? { walletAddress: wallet.address, limit: 100 } : "skip",
  );

  const summary = useMemo(() => {
    const list = (splits ?? []) as SplitDoc[];
    return {
      count: list.length,
      deposited: list.reduce((s, x) => s + x.totalDeposited, 0),
      pending: list.reduce((s, x) => s + x.pendingAmount, 0),
      myPending: list.reduce(
        (s, x) => s + (x.shares.find((sh) => sh.walletAddress === wallet?.address)?.pending ?? 0),
        0,
      ),
    };
  }, [splits, wallet]);

  return (
    <SiteLayout wide>
      <PageHeader
        eyebrow="Payment splits"
        title="Splitter"
        description="Deposit once, distribute to many. Splits validate that shares sum to exactly 100% and let every recipient claim their slice on-chain."
      >
        <Button
          className="gap-2 bg-amber-400 font-medium text-[#241A04] hover:bg-amber-300"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" /> New split
        </Button>
      </PageHeader>

      {!wallet ? (
        <WalletGate
          title="Your splits live here"
          description="Connect a wallet to create splits, deposit funds, distribute shares, and claim what's yours."
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Splits</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{summary.count}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deposited</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-cyan-200">{formatUnits(summary.deposited)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-amber-200">{formatUnits(summary.pending)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Claimable by you</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-emerald-300">{formatUnits(summary.myPending)}</p>
            </div>
          </div>

          {!splits ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading splits…
            </div>
          ) : splits.length === 0 ? (
            <Empty className="min-h-72 border-border/60">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-amber-400/10 text-amber-300">
                  <Split className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No splits yet</EmptyTitle>
                <EmptyDescription>
                  Create a split to fan out a single deposit across maintainers — Alice&apos;s
                  1,000 USDC reaching every developer in one transaction.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center">
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="size-4" /> Create a split
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {(splits as SplitDoc[]).map((s) => (
                <SplitCard key={s._id} split={s} wallet={wallet.address} />
              ))}
            </div>
          )}
        </>
      )}

      <CreateSplitDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SiteLayout>
  );
}
