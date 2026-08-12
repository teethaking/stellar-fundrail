import { Link } from "react-router";
import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Cpu,
  FlaskConical,
  GitFork,
  Globe,
  Heart,
  Landmark,
  Radio,
  Rocket,
  ShieldCheck,
  Split,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";

const PRINCIPLES = [
  {
    icon: Landmark,
    title: "Public goods, public rails",
    body: "Funding open-source maintainers should be as transparent as the code they ship. Every stream, split, and donation is on a public ledger.",
  },
  {
    icon: ShieldCheck,
    title: "Rules in code, not promises",
    body: "No dashboards to reconcile, no invoices to chase. Pause, resume, cancel, withdraw — all enforced by Rust contracts, not by a company's goodwill.",
  },
  {
    icon: GitFork,
    title: "Open-source by default",
    body: "FundRail is MIT-licensed and itself a public good funded through the very rails it provides. The contracts are the documentation.",
  },
  {
    icon: Globe,
    title: "Stellar, not EVM",
    body: "Low fees, fast finality, and a deliberately simple programming model. Rust + Soroban keeps the attack surface small and the code reviewable.",
  },
];

const STACK = [
  { label: "Smart contracts", value: "Rust · Soroban SDK", icon: Cpu },
  { label: "Network", value: "Stellar Testnet · Soroban RPC", icon: Radio },
  { label: "Wallet", value: "Freighter extension · demo wallet", icon: Wallet },
  { label: "Web app", value: "React · TypeScript · Tailwind · shadcn/ui", icon: Globe },
  { label: "Backend (demo)", value: "Convex realtime backend", icon: Rocket },
  { label: "Testing", value: "cargo test · Vitest · GitHub Actions", icon: FlaskConical },
];

const ROADMAP = [
  { status: "done", label: "Funding streams with pause/resume/cancel" },
  { status: "done", label: "Multi-recipient splits with on-chain share validation" },
  { status: "done", label: "Public project registry with off-chain metadata" },
  { status: "done", label: "Donations, wallet auth (Freighter + demo)" },
  { status: "doing", label: "Live Soroban RPC integration for the web app" },
  { status: "todo", label: "Quadratic funding rounds on the registry" },
  { status: "todo", label: "Mainnet deployment + frontend switch" },
];

export default function About() {
  return (
    <SiteLayout wide>
      <PageHeader
        eyebrow="About FundRail"
        title="Funding public goods, on rails."
        description="FundRail is a portfolio project demonstrating production-grade Rust, Soroban smart contracts, and Web3 product engineering — built to show what a Drips-style protocol looks like on Stellar."
      />

      {/* mission */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border/70 bg-card/40 p-7">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Heart className="size-5 text-rose-300" /> Why it exists
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Open-source maintainers do the work the world runs on, and most never get paid for
            it. Platforms like Drips proved that recurring streams and transparent splits can
            fix that. FundRail brings the same ideas to the Stellar ecosystem — a network
            built for cheap, fast, cross-border value movement — implemented from scratch in
            Rust.
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            This project is also a demonstration of craft: audited-style test suites for every
            contract, a clean Cargo workspace, typed end-to-end frontend flows, and CI that
            gates on both Rust and TypeScript checks.
          </p>
        </div>

        <div className="grid gap-5">
          {PRINCIPLES.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="flex gap-4 rounded-xl border border-border/70 bg-card/40 p-5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <p.icon className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{p.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* stack */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold">The stack</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/70 bg-card/40 p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                  <s.icon className="size-4" />
                </span>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              </div>
              <p className="mt-3 font-mono text-sm">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* roadmap */}
      <div className="mt-12 rounded-xl border border-border/70 bg-card/40 p-7">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Rocket className="size-5 text-cyan-300" /> Roadmap
        </h2>
        <ul className="mt-5 space-y-3">
          {ROADMAP.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${
                  r.status === "done"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : r.status === "doing"
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                      : "border-border/70 bg-white/5 text-muted-foreground"
                }`}
              >
                {r.status === "done" ? "✓" : r.status === "doing" ? "→" : "·"}
              </span>
              <span className={`text-sm ${r.status === "todo" ? "text-muted-foreground" : "text-foreground"}`}>
                {r.label}
              </span>
              {r.status === "doing" && (
                <Badge variant="secondary" className="font-mono text-[9px]">
                  in progress
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.04] p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
          <Split className="size-6" />
        </span>
        <h2 className="text-2xl font-bold tracking-tight">See the rails in action</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Explore the live registry, read the contract docs, or connect the demo wallet and
          create your first stream in under a minute.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-4 py-2 text-sm font-medium text-[#04141B] transition-colors hover:bg-cyan-300"
          >
            Explore projects <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 rounded-md border border-border/70 px-4 py-2 text-sm font-medium transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/5"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
