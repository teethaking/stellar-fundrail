import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/hooks/use-wallet";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { WalletGate } from "@/components/wallet/WalletGate";
import { CreateStreamDialog } from "@/components/streams/CreateStreamDialog";
import { StreamCard, type StreamLive } from "@/components/streams/StreamCard";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Loader2, Plus, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeSlideUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function Streams() {
  const { wallet } = useWallet();
  const [searchParams] = useSearchParams();
  const recipientPrefill = searchParams.get("recipient") ?? undefined;

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [createOpen, setCreateOpen] = useState(recipientPrefill != null);

  const streams = useQuery(
    api.streams.list,
    wallet ? { walletAddress: wallet.address, limit: 200 } : "skip",
  );

  const filtered = useMemo(() => {
    if (!streams) return undefined;
    if (filter === "all") return streams as StreamLive[];
    return (streams as StreamLive[]).filter((s) => s.status === filter);
  }, [streams, filter]);

  return (
    <SiteLayout wide>
      <PageHeader
        eyebrow="Recurring funding"
        title="Funding streams"
        description="Per-second streams between wallets. Funds accrue continuously, sender-controlled, recipient-withdrawable — exactly as enforced by the funding_stream contract."
      >
        <Button
          className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" /> New stream
        </Button>
      </PageHeader>

      {!wallet ? (
        <WalletGate
          title="Your streams live here"
          description="Connect a wallet to see streams you send and receive. Streams you create are recorded on-chain and mirrored to this dashboard."
        />
      ) : (
        <>
          {/* Animated filter tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <motion.button
                key={f.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(f.key)}
                className={`relative cursor-pointer rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  filter === f.key
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                {filter === f.key && (
                  <motion.div
                    layoutId="stream-filter-indicator"
                    className="absolute inset-0 rounded-md border border-cyan-400/30 bg-cyan-400/5"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>

          {!filtered ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading streams…
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="min-h-72 border-border/60">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-cyan-400/10 text-cyan-300">
                  <Radio className="size-6" />
                </EmptyMedia>
                <EmptyTitle>{filter === "all" ? "No streams yet" : `No ${filter} streams`}</EmptyTitle>
                <EmptyDescription>
                  Create a stream to fund a project per second — or wait for someone to stream
                  to your wallet.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center">
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="size-4" /> Create a stream
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={filter}
                variants={stagger}
                initial="hidden"
                animate="show"
                className="grid gap-5 md:grid-cols-2"
              >
                {filtered.map((s) => (
                  <motion.div key={s._id} variants={fadeSlideUp}>
                    <StreamCard stream={s} wallet={wallet.address} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}

      <CreateStreamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefillRecipient={recipientPrefill}
      />
    </SiteLayout>
  );
}
