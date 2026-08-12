import { useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useEnsureSeed } from "@/hooks/use-ensure-seed";
import { useWallet } from "@/hooks/use-wallet";
import { useNow } from "@/hooks/use-now";
import { LogoMark } from "@/components/site/Logo";
import { WalletButton } from "@/components/site/WalletButton";
import { StreamCard, type StreamLive } from "@/components/streams/StreamCard";
import { CreateStreamDialog } from "@/components/streams/CreateStreamDialog";
import { CreateSplitDialog } from "@/components/splits/CreateSplitDialog";
import { RegisterProjectDialog } from "@/components/projects/RegisterProjectDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { claimableAmount } from "@/lib/stream-math";
import { formatUnits, formatUnitsCompact, shortAddress, timeAgo } from "@/lib/stellar";
import {
  Activity,
  Compass,
  Heart,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  Radio,
  Split,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

type ActivityDoc = Doc<"activities">;

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/streams", label: "Streams", icon: Radio },
  { to: "/splitter", label: "Splitter", icon: Split },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/explore", label: "Explore", icon: Compass },
];

export default function Dashboard() {
  useEnsureSeed();
  const { user, signOut } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const now = useNow();

  const [streamOpen, setStreamOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const streams = useQuery(
    api.streams.list,
    wallet ? { walletAddress: wallet.address, limit: 100 } : "skip",
  );
  const activities = useQuery(
    api.activities.list,
    wallet ? { walletAddress: wallet.address, limit: 200 } : "skip",
  );
  const splits = useQuery(
    api.splits.list,
    wallet ? { walletAddress: wallet.address, limit: 100 } : "skip",
  );

  const stats = useMemo(() => {
    const list = (streams ?? []) as StreamLive[];
    const acts = (activities ?? []) as ActivityDoc[];
    return {
      sent: acts.filter((a) => a.direction === "out").reduce((s, a) => s + (a.amount ?? 0), 0),
      received: acts.filter((a) => a.direction === "in").reduce((s, a) => s + (a.amount ?? 0), 0),
      activeStreams: list.filter((s) => s.status === "active").length,
      claimable: list.reduce((s, st) => {
        if (st.recipientWallet !== wallet?.address) return s;
        return s + claimableAmount(st, now);
      }, 0),
      pendingSplits: (splits ?? []).reduce(
        (s, x) => s + (x.shares.find((sh) => sh.walletAddress === wallet?.address)?.pending ?? 0),
        0,
      ),
    };
  }, [streams, activities, splits, wallet, now]);

  const myStreams = useMemo(() => {
    const list = (streams ?? []) as StreamLive[];
    return list
      .filter((s) => s.status === "active")
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 3);
  }, [streams]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch {
      // ignore
    }
  };

  const initials = (user?.name ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#05070D]">
      {/* ===== sidebar (desktop) ===== */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border/60 bg-[#04060B] lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-5">
          <LogoMark className="size-7" />
          <span className="text-sm font-semibold tracking-tight">
            Fund<span className="text-cyan-300">Rail</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground",
                  isActive && "bg-cyan-400/10 text-cyan-200",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border/50 p-4">
          <WalletButton />
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-200">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.name ?? "Signed in"}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {wallet ? shortAddress(wallet.address, 5) : "no wallet"}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="cursor-pointer text-muted-foreground transition-colors hover:text-red-400"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== main ===== */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-[#05070D]/90 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <LogoMark className="size-6" />
              <span className="text-sm font-semibold">FundRail</span>
            </div>
            <div className="flex items-center gap-2">
              <WalletButton compact />
              <button
                onClick={handleSignOut}
                className="cursor-pointer text-muted-foreground hover:text-red-400"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
                    isActive && "bg-cyan-400/10 text-cyan-200",
                  )
                }
              >
                <item.icon className="size-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {/* header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300/80">Dashboard</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {user?.name ? `Welcome, ${user.name}` : "Welcome back"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {wallet ? (
                  <>
                    Connected as <span className="font-mono text-cyan-200">{shortAddress(wallet.address, 6)}</span>
                  </>
                ) : (
                  "Connect a wallet to see your funding."
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setStreamOpen(true)}>
                <Plus className="size-4" /> Stream
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setSplitOpen(true)}>
                <Plus className="size-4" /> Split
              </Button>
              <Button className="gap-2 bg-cyan-400 font-medium text-[#04141B] hover:bg-cyan-300" onClick={() => setRegisterOpen(true)}>
                <Plus className="size-4" /> Register project
              </Button>
            </div>
          </div>

          {/* stats */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total sent"
              value={formatUnits(stats.sent)}
              hint="across streams, splits & donations"
              icon={TrendingUp}
              tone="rose"
            />
            <StatCard
              label="Total received"
              value={formatUnits(stats.received)}
              hint="withdrawals & claims"
              icon={TrendingDown}
              tone="emerald"
            />
            <StatCard
              label="Active streams"
              value={String(stats.activeStreams)}
              hint="accruing right now"
              icon={Radio}
              tone="cyan"
            />
            <StatCard
              label="Claimable now"
              value={formatUnits(stats.claimable)}
              hint={`+ ${formatUnits(stats.pendingSplits)} pending in splits`}
              icon={Wallet}
              tone="amber"
            />
          </div>

          {/* quick actions for unconnected wallet */}
          {!wallet && (
            <div className="mt-8 rounded-xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.03] p-6">
              <p className="text-sm font-medium">Your dashboard is wallet-powered</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Streams, splits, and activity are keyed to your Stellar address. Connect
                Freighter or use the demo wallet — nothing to install.
              </p>
              <div className="mt-4">
                <WalletButton />
              </div>
            </div>
          )}

          {/* active streams */}
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active streams</h2>
              <Link to="/streams" className="text-sm text-cyan-300 hover:text-cyan-200">
                Manage all →
              </Link>
            </div>
            {!streams ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : myStreams.length === 0 ? (
              <Empty className="min-h-40 border-border/60">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-cyan-400/10 text-cyan-300">
                    <Radio className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No active streams</EmptyTitle>
                  <EmptyDescription>
                    {wallet ? "Start a per-second stream to a project or maintainer." : "Connect a wallet to create your first stream."}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex-row justify-center">
                  <Button onClick={() => setStreamOpen(true)} className="gap-2">
                    <Plus className="size-4" /> Create a stream
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {myStreams.map((s) => (
                  <StreamCard key={s._id} stream={s} wallet={wallet?.address ?? null} />
                ))}
              </div>
            )}
          </div>

          {/* recent activity */}
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <Link to="/activity" className="text-sm text-cyan-300 hover:text-cyan-200">
                Full ledger →
              </Link>
            </div>
            {!activities ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : activities.length === 0 ? (
              <Empty className="min-h-40 border-border/60">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Heart className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No activity yet</EmptyTitle>
                  <EmptyDescription>Your funding history will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/70 bg-card/40">
                {(activities as ActivityDoc[]).slice(0, 6).map((a) => (
                  <div key={a._id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md",
                        a.direction === "in" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300",
                      )}
                    >
                      {a.direction === "in" ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.note ?? a.type.replace(/_/g, " ")}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {timeAgo(a.createdAt)} {a.counterparty && `· ${shortAddress(a.counterparty, 5)}`}
                      </p>
                    </div>
                    {a.amount != null && (
                      <p className={cn("shrink-0 font-mono text-sm font-semibold", a.direction === "in" ? "text-emerald-300" : "text-rose-300")}>
                        {a.direction === "in" ? "+" : "−"}{formatUnits(a.amount)} {a.token}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* splits summary */}
          {wallet && (splits ?? []).length > 0 && (
            <div className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your splits</h2>
                <Link to="/splitter" className="text-sm text-cyan-300 hover:text-cyan-200">
                  Manage splits →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {(splits ?? []).slice(0, 3).map((s) => (
                  <Link
                    key={s._id}
                    to="/splitter"
                    className="group rounded-xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-cyan-400/25"
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate font-mono text-sm font-semibold">{s.title}</p>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {s.token}
                      </Badge>
                    </div>
                    <p className="mt-3 font-mono text-lg font-semibold text-cyan-200">{formatUnitsCompact(s.totalDeposited)}</p>
                    <p className="text-[11px] text-muted-foreground">deposited · {s.shares.length} recipients</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <CreateStreamDialog open={streamOpen} onOpenChange={setStreamOpen} />
      <CreateSplitDialog open={splitOpen} onOpenChange={setSplitOpen} />
      <RegisterProjectDialog open={registerOpen} onOpenChange={setRegisterOpen} onRegistered={(slug) => navigate(`/project/${slug}`)} />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    cyan: "bg-cyan-400/10 text-cyan-300",
    emerald: "bg-emerald-400/10 text-emerald-300",
    amber: "bg-amber-400/10 text-amber-300",
    rose: "bg-rose-400/10 text-rose-300",
  };
  return (
    <div className="rounded-xl border border-border/70 bg-card/50 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={cn("flex size-7 items-center justify-center rounded-md", tones[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 font-mono text-xl font-semibold sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
