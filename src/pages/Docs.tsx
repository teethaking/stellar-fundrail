import { SiteLayout, PageHeader } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Boxes, FlaskConical, Rocket, ScrollText, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-[#0A0F1A] p-4 font-mono text-xs leading-6 text-cyan-100/90">
      {children}
    </pre>
  );
}

const SECTIONS = [
  {
    id: "overview",
    icon: BookOpen,
    title: "Overview",
    body: (
      <>
        <p>
          FundRail is a decentralized funding and contribution platform for public goods,
          inspired by protocols like Drips. The entire value layer runs as Rust smart contracts
          on Stellar&apos;s Soroban, deployed to Testnet; the web app is a TypeScript + React
          interface over the same rails.
        </p>
        <p className="mt-3">
          The web app you&apos;re looking at runs against a Convex-backed simulation of the
          contracts so the whole product can be explored without a wallet — the same math,
          the same rules, the same ledger. The real contracts live in{" "}
          <code className="font-mono text-xs">contracts/</code> and are deployable with the
          Soroban CLI.
        </p>
      </>
    ),
  },
  {
    id: "architecture",
    icon: Boxes,
    title: "Architecture",
    body: (
      <>
        <p>Four contracts, one purpose each — no kitchen sinks:</p>
        <Code>{`contracts/
├── funding_stream/   # per-second streams: create, pause, resume, cancel, withdraw
├── splitter/         # shares that sum to 10,000 bps: deposit, distribute, claim
├── registry/         # public project registry with off-chain metadata URIs
└── token_vault/      # reusable escrow primitive (deposit / withdraw / balance)

# Cargo workspace: cargo test runs every contract's unit + integration tests.`}</Code>
        <p className="mt-3">
          <span className="font-medium">funding_stream</span> escrows the total amount and
          releases it per-second to the recipient. The sender alone can pause, resume, or
          cancel; the recipient alone can withdraw, and never more than the claimable balance.
        </p>
        <p className="mt-3">
          <span className="font-medium">splitter</span> holds deposits and fans them out to
          recipients proportionally. Shares are validated to total exactly 10,000 basis
          points, and edits are locked while funds are pending.
        </p>
        <p className="mt-3">
          <span className="font-medium">registry</span> stores only small metadata on-chain
          (name, description, wallet, GitHub, website, metadata URI); anything large lives
          off-chain behind the URI.
        </p>
      </>
    ),
  },
  {
    id: "funding-stream",
    icon: ScrollText,
    title: "Funding Stream contract",
    body: (
      <>
        <p>Public functions: <code className="font-mono text-xs">create_stream</code>,{" "}
          <code className="font-mono text-xs">pause_stream</code>,{" "}
          <code className="font-mono text-xs">resume_stream</code>,{" "}
          <code className="font-mono text-xs">cancel_stream</code>,{" "}
          <code className="font-mono text-xs">withdraw</code>,{" "}
          <code className="font-mono text-xs">claimable_balance</code>,{" "}
          <code className="font-mono text-xs">stream_details</code>.
        </p>
        <Code>{`pub fn create_stream(
    env: Env,
    sender: Address,
    recipient: Address,
    token: Address,
    start_time: u64,
    end_time: u64,
    rate: i128,          // base units per second
    total_amount: i128,  // rate * (end - start), escrowed up front
) -> u32 {
    sender.require_auth();
    // validate timestamps, addresses, amount; transfer token into escrow;
    // store Stream { sender, recipient, token, start, end, rate,
    //                total, withdrawn, paused_until, status }
}`}</Code>
        <p className="mt-3">
          Accrual is pure math:{" "}
          <code className="font-mono text-xs">
            accrued = rate * max(0, now − start − paused_duration)
          </code>
          , capped at <code className="font-mono text-xs">total_amount</code>. While paused the
          clock freezes at <code className="font-mono text-xs">paused_until</code>; on resume
          the pause is folded into <code className="font-mono text-xs">paused_duration</code>.
          Cancelling refunds the unearned remainder to the sender and leaves the accrued
          balance withdrawable by the recipient.
        </p>
      </>
    ),
  },
  {
    id: "splitter",
    icon: ScrollText,
    title: "Splitter contract",
    body: (
      <>
        <p>
          Public functions: <code className="font-mono text-xs">create_split</code>,{" "}
          <code className="font-mono text-xs">update_split</code>,{" "}
          <code className="font-mono text-xs">deposit</code>,{" "}
          <code className="font-mono text-xs">distribute</code>,{" "}
          <code className="font-mono text-xs">claim</code>,{" "}
          <code className="font-mono text-xs">remove_recipient</code>.
        </p>
        <Code>{`// Alice deposits 1_000 USDC into a split with three recipients.
// distribute() splits it proportionally:
//   A (50%) -> 500, B (30%) -> 300, C (20%) -> 200  (each pending)
// claim() moves a recipient's pending slice to their wallet.

pub fn distribute(env: Env, split_id: u32, caller: Address) {
    caller.require_auth();
    // only the owner may distribute
    // allocatable = total_deposited - distributed_amount
    // for each share: pending += allocatable * bps / 10_000
}`}</Code>
        <p className="mt-3">
          Shares are stored in basis points and must sum to exactly 10,000 — checked at
          creation and again on every update. Recipients can claim at any time; the owner can
          remove a recipient only once that recipient has nothing pending.
        </p>
      </>
    ),
  },
  {
    id: "registry",
    icon: ScrollText,
    title: "Project Registry contract",
    body: (
      <>
        <p>
          Public functions: <code className="font-mono text-xs">register_project</code>,{" "}
          <code className="font-mono text-xs">update_project</code>,{" "}
          <code className="font-mono text-xs">get_project</code>,{" "}
          <code className="font-mono text-xs">project_count</code>,{" "}
          <code className="font-mono text-xs">list_projects</code>.
        </p>
        <Code>{`pub fn register_project(
    env: Env,
    creator: Address,
    name: String,
    description: String,
    github: Option<String>,
    website: Option<String>,
    wallet: Address,
    metadata_uri: Option<String>,
) -> u32 {
    creator.require_auth();
    // slugify(name) to keep the ID stable; persist Project struct;
    // heavy content (readmes, assets) belongs behind metadata_uri
}`}</Code>
        <p className="mt-3">
          The registry is a directory, not a treasury — funding flows to the project&apos;s
          wallet address through the other contracts. Anyone can register; only the creator
          can update metadata.
        </p>
      </>
    ),
  },
  {
    id: "deploy",
    icon: Rocket,
    title: "Deploying to Testnet",
    body: (
      <>
        <p>Requires the Soroban CLI and a funded testnet account:</p>
        <Code>{`# build + test
cargo build --workspace
cargo test --workspace

# install a testnet account
soroban keys generate alice --network testnet
soroban keys fund alice --network testnet

# deploy the funding_stream contract
soroban contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/funding_stream.wasm \\
  --source alice --network testnet

# invoke (token = Stellar Asset Contract for the funding token)
soroban contract invoke --id <CONTRACT_ID> --source alice \\
  --network testnet \\
  -- create_stream --sender <ALICE> --recipient <BOB> \\
  --token <SAC_ID> --start_time 1720000000 --end_time 1750000000 \\
  --rate 1000000 --total_amount 30000000000`}</Code>
      </>
    ),
  },
  {
    id: "testing",
    icon: FlaskConical,
    title: "Testing & security",
    body: (
      <>
        <p>
          Every contract ships with unit and integration tests using{" "}
          <code className="font-mono text-xs">soroban_sdk::testutils</code>. The test suite
          covers the failure modes that matter for money-moving contracts:
        </p>
        <Code>{`// funding_stream::test
#[test] fn withdraw_before_start_fails() { ... }
#[test] fn only_recipient_can_withdraw() { ... }
#[test] fn no_double_withdrawal() { ... }
#[test] fn pause_freezes_accrual() { ... }
#[test] fn cancel_refunds_unearned() { ... }

// splitter::test
#[test] fn shares_must_sum_to_10000() { ... }
#[test] fn distribution_is_proportional() { ... }
#[test] fn only_owner_distributes() { ... }
#[test] fn edit_locked_while_pending() { ... }`}</Code>
        <p className="mt-3">
          All integer arithmetic uses <code className="font-mono text-xs">i128</code> with
          explicit checked operations — Soroban panics on overflow rather than wrapping. See{" "}
          <code className="font-mono text-xs">SECURITY.md</code> in the contracts workspace for
          the threat model and invariants.
        </p>
      </>
    ),
  },
];

export default function Docs() {
  return (
    <SiteLayout wide>
      <PageHeader
        eyebrow="Developer docs"
        title="FundRail developer documentation"
        description="How the platform works under the hood: the Soroban contract architecture, deployment to Stellar Testnet, and the testing discipline behind it."
      />

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <s.icon className="size-4" />
                {s.title}
              </a>
            ))}
            <div className="mt-6 rounded-lg border border-border/60 p-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Next</p>
              <Link to="/about" className="mt-1 block text-sm text-cyan-300 hover:text-cyan-200">
                About FundRail →
              </Link>
            </div>
          </nav>
        </aside>

        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="font-mono text-[10px]">Rust</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">Soroban SDK</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">Stellar Testnet</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">soroban-cli</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">cargo test</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">GitHub Actions</Badge>
          </div>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 rounded-xl border border-border/70 bg-card/40 p-6">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                  <s.icon className="size-4" />
                </span>
                {s.title}
              </h2>
              <div className="mt-4 text-sm leading-7 text-muted-foreground">{s.body}</div>
            </section>
          ))}

          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] p-5 text-sm leading-6 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <p>
              FundRail is a portfolio-quality reference implementation. Contracts are MIT
              licensed, tested, and intended for Testnet. Do your own review before moving
              real funds on Mainnet.
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
