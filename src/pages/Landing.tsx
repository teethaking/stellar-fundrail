import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { ProjectCard } from "@/components/site/ProjectCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Compass,
  GitFork,
  Landmark,
  Lock,
  Radio,
  ShieldCheck,
  Split,
  Wallet,
  Waves,
} from "lucide-react";
import { accruedAmount } from "@/lib/stream-math";
import { formatUnits, shortAddress } from "@/lib/stellar";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.5, ease: "easeOut" as const },
  }),
};

const FEATURES = [
  {
    icon: Waves,
    title: "Recurring streams",
    body: "Fund a maintainer per second, not per ask. Streams accrue continuously and can be paused, resumed, or cancelled by the sender — all on-chain.",
  },
  {
    icon: Split,
    title: "Splits, not sweeps",
    body: "Deposit once and let a split distribute to any number of recipients. Alice's 1,000 USDC reaches every maintainer with a single transaction.",
  },
  {
    icon: Landmark,
    title: "Public project registry",
    body: "A transparent registry of funded projects with wallets, metadata, and full funding history. No gatekeepers — anyone can register.",
  },
  {
    icon: ShieldCheck,
    title: "Contract-grade security",
    body: "Every rule enforced in Rust: sender-only control, no double withdrawals, no overflow, and shares that must sum to exactly 100%.",
  },
  {
    icon: Lock,
    title: "Testnet-first",
    body: "Everything runs against Stellar Testnet with real Soroban contracts and Freighter wallet signatures. Safe to experiment, ready for mainnet.",
  },
  {
    icon: GitFork,
    title: "Open-source by default",
    body: "MIT-licensed contracts, frontend, and docs. FundRail is itself a public good funded through the very rails it provides.",
  },
];

const STEPS = [
  {
    icon: Wallet,
    step: "01",
    title: "Connect your Stellar wallet",
    body: "Pair Freighter or use the demo wallet. Your Stellar address is your identity across the platform.",
  },
  {
    icon: Radio,
    step: "02",
    title: "Stream or split your funding",
    body: "Create a per-second stream to a project, or deposit into a split that fans out to many maintainers at once.",
  },
  {
    icon: Compass,
    step: "03",
    title: "Track, withdraw, and explore",
    body: "Watch funds accrue in real time, withdraw whenever you like, and explore how the whole ecosystem is funded.",
  },
];

const SPLIT_DEMO = [
  { label: "Maintainer A", pct: 50, color: "#22D3EE" },
  { label: "Maintainer B", pct: 30, color: "#38BDF8" },
  { label: "Maintainer C", pct: 20, color: "#FBBF24" },
];

const TICKER_ITEMS = ["USDC", "XLM", "SOROBAN", "TESTNET", "RUST", "PUBLIC GOODS", "FREIGHTER", "DRIPS"];

function LiveStreamDemo() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const stream = {
    startTime: now - 18 * 86_400_000,
    endTime: now + 12 * 86_400_000,
    rate: Math.floor(250_000 / (30 * 86_400_000)),
    totalAmount: 250_000,
    withdrawnAmount: 0,
    pausedDuration: 0,
    status: "active" as const,
  };
  const accrued = accruedAmount(stream, now);
  const progress = accrued / stream.totalAmount;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-6 shadow-2xl shadow-cyan-500/5 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-xs text-muted-foreground">stream:live</span>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px]">
          soroban-sdk-rs
        </Badge>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm text-foreground">{shortAddress("GB5M4KDAIYQT3RUSHKI4OLPOESAEELBTP7OCR4ORTHT3RLDCEL6HHQ63")}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sender</p>
        </div>
        <div className="flex-1 px-2">
          <svg viewBox="0 0 120 24" className="w-full">
            <line x1="0" y1="12" x2="120" y2="12" stroke="rgba(148,163,184,0.25)" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="12" x2="120" y2="12" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" className="rail-dash" />
            <circle cx="60" cy="12" r="5" fill="#FBBF24" />
          </svg>
        </div>
        <div className="min-w-0 text-right">
          <p className="font-mono text-sm text-foreground">{shortAddress("GB5M4KDAIYQT3RUSHKI4OLPOESAEELBTP7OCR4ORTHT3RLDCEL6HHQ63", 3)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Recipient</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between">
          <p className="font-mono text-2xl font-semibold text-cyan-200">
            {formatUnits(accrued)} <span className="text-sm text-muted-foreground">USDC</span>
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">accrued</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>rate: {formatUnits(stream.rate * 86_400_000)} USDC/day</span>
          <span>{Math.round(progress * 100)}% of 250,000</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Claimable now</p>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">{formatUnits(accrued)} USDC</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
          <p className="mt-1 font-mono text-sm font-medium text-emerald-300">Active</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list, { limit: 3 });

  const goToApp = (path: string) => navigate(`/auth?returnTo=${encodeURIComponent(path)}`);

  const totalRaised =
    projects?.reduce((sum, p) => sum + p.totalReceived, 0) ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#05070D]">
      <Navbar />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 top-40 h-[360px] w-[360px] rounded-full bg-amber-400/8 blur-[100px]" />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:pb-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div initial="hidden" animate="show">
              <motion.div variants={fadeUp} custom={0}>
                <Badge
                  variant="outline"
                  className="gap-2 border-cyan-400/30 bg-cyan-400/5 px-3 py-1 font-mono text-[11px] text-cyan-200"
                >
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  Open-source · Soroban · Stellar Testnet
                </Badge>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl"
              >
                Funding public goods,{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-amber-300 bg-clip-text text-transparent">
                  on rails.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
              >
                FundRail is a decentralized funding platform where open-source
                projects receive recurring streams, one-time donations, and
                multi-recipient splits — enforced by Rust smart contracts on the
                Stellar network, not by promises.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="gap-2 bg-cyan-400 font-medium text-[#04141B] shadow-lg shadow-cyan-400/20 hover:bg-cyan-300"
                  onClick={() => navigate("/explore")}
                >
                  Explore projects
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-border/70 hover:border-cyan-400/40 hover:bg-cyan-400/5"
                  onClick={() => goToApp("/dashboard")}
                >
                  <Radio className="size-4" />
                  Start a stream
                </Button>
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={4}
                className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Lock className="size-3.5 text-emerald-300" /> MIT-licensed contracts
                </span>
                <span className="flex items-center gap-1.5">
                  <GitFork className="size-3.5 text-emerald-300" /> No EVM — Rust + Soroban only
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-300" /> Audited patterns, testnet-ready
                </span>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            >
              <LiveStreamDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ TICKER ============ */}
      <section className="border-y border-border/50 bg-white/[0.02] py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 overflow-hidden">
          {TICKER_ITEMS.map((item) => (
            <span key={item} className="font-mono text-xs tracking-[0.25em] text-muted-foreground/70">
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300/80">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From wallet to maintainer in three moves
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            No dashboards to reconcile, no invoices to chase. Funds move
            programmatically along rails that never sleep.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              custom={i}
              className="relative rounded-xl border border-border/70 bg-card/50 p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-2xl font-bold text-white/5">{step.step}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="border-y border-border/50 bg-white/[0.015]">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300/80">Why FundRail</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a public good needs to get paid
            </h2>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
                className="group rounded-xl border border-border/70 bg-card/50 p-6 transition-colors hover:border-cyan-400/25"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/15 to-sky-400/5 text-cyan-300 transition-transform group-hover:scale-105">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SPLIT DEMO ============ */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-300/80">
              Payment splits
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Alice deposits 1,000 USDC. Everyone gets paid.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
              A single deposit into a split contract fans out to every recipient
              proportionally — 50%, 30%, 20% — with each share claimable by its
              owner. Shares are validated to sum to exactly 100% on-chain, and
              only the owner can reconfigure the split.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">
                <span className="text-foreground">Alice</span> → split:core-maintainers
              </span>
              <ArrowRight className="size-4 text-amber-300" />
              <span className="font-mono text-xs text-muted-foreground">1,000 USDC</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-6">
            <p className="font-mono text-xs text-muted-foreground">split:core-maintainers · USDC</p>
            <div className="mt-5 space-y-4">
              {SPLIT_DEMO.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.pct}% · {r.pct * 10} USDC
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${r.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.15 }}
                      className="h-full rounded-full"
                      style={{ background: r.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-border/50 pt-4 text-center font-mono text-[11px] text-muted-foreground">
              total shares: <span className="text-emerald-300">10,000 / 10,000 bps ✓</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SEEDED PROJECTS ============ */}
      <section className="border-y border-border/50 bg-white/[0.015]">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300/80">Live registry</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Funded right now on FundRail
              </h2>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/explore")}>
              View all projects
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 rounded-2xl border border-border/70 bg-card/40 p-8 sm:grid-cols-3 sm:p-10">
          <div className="text-center">
            <p className="font-mono text-3xl font-semibold text-cyan-200 sm:text-4xl">
              {formatUnits(totalRaised || 0).replace(/\.\d+$/, "")}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              USDC raised by registry projects
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-3xl font-semibold text-amber-200 sm:text-4xl">
              {projects?.length ?? 0}+
            </p>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              Public projects registered
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-3xl font-semibold text-emerald-200 sm:text-4xl">
              {projects?.reduce((s, p) => s + p.supporterCount, 0) ?? 0}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
              Unique supporters
            </p>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative overflow-hidden border-t border-border/50">
        <div className="bg-grid absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Start funding the software you depend on.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Connect your wallet, register a project, or launch your first stream
            in under a minute. No platform fees, no middlemen — just rails.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="gap-2 bg-cyan-400 font-medium text-[#04141B] shadow-lg shadow-cyan-400/20 hover:bg-cyan-300"
              onClick={() => navigate("/explore")}
            >
              Explore the registry
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={() => goToApp("/dashboard")}
            >
              Open dashboard
            </Button>
          </div>
          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            Built with Rust · Soroban · Stellar Testnet · TypeScript
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
