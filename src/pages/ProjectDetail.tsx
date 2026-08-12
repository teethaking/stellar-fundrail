import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/hooks/use-wallet";
import { SiteLayout } from "@/components/site/SiteLayout";
import { StreamCard, type StreamLive } from "@/components/streams/StreamCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatUnits, formatUnitsCompact, formatDate, parseUnits, shortAddress, simulateTxHash, timeAgo } from "@/lib/stellar";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Github,
  Globe,
  Heart,
  History,
  Loader2,
  Radio,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const DONATE_PRESETS = [10, 50, 250, 1_000];

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { wallet } = useWallet();

  const project = useQuery(api.projects.get, { slug: slug ?? "" });
  const support = useMutation(api.projects.supportProject);

  const [amount, setAmount] = useState("50");
  const [token, setToken] = useState("USDC");
  const [copied, setCopied] = useState(false);
  const [donating, setDonating] = useState(false);

  const streams = useQuery(api.streams.list, { limit: 100 });
  const projectStreams = useMemo(
    () =>
      (streams ?? [])
        .filter((s) => s.recipientWallet === project?.walletAddress)
        .slice(0, 3) as StreamLive[],
    [streams, project],
  );

  const history = useQuery(
    api.activities.byProject,
    project ? { projectId: project._id as never, limit: 50 } : "skip",
  );

  const contributors = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of history ?? []) {
      if (a.type === "donation" && a.counterparty && a.amount) {
        seen.set(a.counterparty, (seen.get(a.counterparty) ?? 0) + a.amount);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [history]);

  if (!project) {
    return (
      <SiteLayout>
        <div className="flex items-center justify-center gap-2 py-32 text-sm text-muted-foreground">
          {slug ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Looking up project…
            </>
          ) : (
            "Project not found"
          )}
        </div>
      </SiteLayout>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(project.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      toast.error("Connect a wallet to donate");
      return;
    }
    let units: number;
    try {
      units = parseUnits(amount.trim());
    } catch {
      toast.error("Enter a valid amount");
      return;
    }
    if (units <= 0) {
      toast.error("Amount must be positive");
      return;
    }
    setDonating(true);
    try {
      await support({
        slug: project.slug,
        amount: units,
        token,
        fromWallet: wallet.address,
        txHash: simulateTxHash("don"),
      });
      toast.success("Donation recorded", {
        description: `${amount} ${token} to ${project.name} — thank you for funding public goods.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Donation failed");
    } finally {
      setDonating(false);
    }
  };

  return (
    <SiteLayout wide>
      <Link to="/explore" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to explore
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* left column */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {project.tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                #{t}
              </Badge>
            ))}
            <Badge variant="secondary" className="font-mono text-[10px] text-emerald-300">
              ● {project.status}
            </Badge>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{project.name}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {project.description}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {project.githubUrl && (
              <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
                <Github className="size-4" /> GitHub
              </a>
            )}
            {project.website && (
              <a href={project.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
                <Globe className="size-4" /> Website
              </a>
            )}
            <button onClick={handleCopy} className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
              {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
              {copied ? "Copied!" : shortAddress(project.walletAddress, 6)}
            </button>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Raised</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-cyan-200">{formatUnitsCompact(project.totalReceived)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">USDC total</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Supporters</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-amber-200">{project.supporterCount.toLocaleString()}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">unique wallets</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/50 p-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Registered</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{formatDate(project.createdAt)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">on the registry</p>
            </div>
          </div>

          {/* funding history */}
          <div className="mt-10">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <History className="size-4 text-cyan-300" /> Funding history
            </h2>
            {!history ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : history.length === 0 ? (
              <Empty className="min-h-40 border-border/60">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Heart className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No funding yet</EmptyTitle>
                  <EmptyDescription>Be the first to support this project.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="mt-4 divide-y divide-border/50 rounded-xl border border-border/70 bg-card/40">
                {history.slice(0, 10).map((a) => (
                  <div key={a._id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                      a.direction === "in" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"
                    }`}>
                      {a.direction === "in" ? "IN" : "OUT"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.note ?? a.type.replace(/_/g, " ")}</p>
                      <p className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{timeAgo(a.createdAt)}</span>
                        {a.txHash && <span className="truncate">{a.txHash}</span>}
                      </p>
                    </div>
                    {a.amount != null && (
                      <p className={`font-mono text-sm font-semibold ${a.direction === "in" ? "text-emerald-300" : "text-rose-300"}`}>
                        {a.direction === "in" ? "+" : "−"}{formatUnits(a.amount)} {a.token}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-6">
          {/* donate */}
          <form onSubmit={handleDonate} className="rounded-xl border border-border/70 bg-card/60 p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Heart className="size-4 text-rose-300" /> Support this project
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              One-time donation to {shortAddress(project.walletAddress, 5)}. Every contribution
              is written to the public ledger.
            </p>

            <div className="mt-5 flex items-center gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="h-10 flex-1 font-mono text-sm"
                aria-label="Donation amount"
              />
              <Select value={token} onValueChange={setToken}>
                <SelectTrigger className="h-10 w-24 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="XLM">XLM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DONATE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`cursor-pointer rounded-md border px-3 py-1 font-mono text-xs transition-colors ${
                    Number(amount) === p
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                      : "border-border/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p} {token}
                </button>
              ))}
            </div>
            <Button
              type="submit"
              disabled={donating}
              className="mt-4 w-full gap-2 bg-rose-400 font-medium text-[#1A0B0B] hover:bg-rose-300"
            >
              <Heart className="size-4" />
              {donating ? "Sending…" : wallet ? `Donate ${amount || "0"} ${token}` : "Connect wallet to donate"}
            </Button>
            {!wallet && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Connect a wallet from the navbar to donate.
              </p>
            )}
          </form>

          {/* stream CTA */}
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Radio className="size-4 text-cyan-300" /> Stream instead
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Set up a per-second recurring stream to this project&apos;s wallet. Pause, resume,
              or cancel anytime — on-chain.
            </p>
            <Button
              className="mt-4 w-full gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300"
              onClick={() => navigate(`/streams?recipient=${encodeURIComponent(project.walletAddress)}`)}
            >
              Create a stream <ArrowRight className="size-4" />
            </Button>
          </div>

          {/* contributors */}
          {contributors.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card/40 p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Users className="size-4 text-amber-300" /> Top supporters
              </h2>
              <div className="mt-4 space-y-2.5">
                {contributors.map(([addr, total]) => (
                  <div key={addr} className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-xs">{shortAddress(addr, 6)}</span>
                    <span className="shrink-0 font-mono text-xs text-emerald-300">
                      {formatUnitsCompact(total)} USDC
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* streams to this project */}
      {projectStreams.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active streams to this wallet</h2>
            <Link to="/streams" className="text-sm text-cyan-300 hover:text-cyan-200">
              View all streams →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projectStreams.map((s) => (
              <StreamCard key={s._id} stream={s} wallet={wallet?.address ?? null} />
            ))}
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
