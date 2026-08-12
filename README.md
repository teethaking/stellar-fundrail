# FundRail

Decentralized funding and contribution platform for public goods, inspired by protocols like
[Drips](https://drips.network). The entire value layer runs as Rust smart contracts on
**Stellar Soroban** (deployable to Testnet); the web app is a TypeScript + React interface over
the same rails.

**This is a portfolio-quality, open-source reference implementation — experimental, tested,
and intended for Testnet. Not audited. Do not move real funds on Mainnet without your own review.**

## What it does

- Connect a Stellar wallet (Freighter extension or a built-in demo wallet)
- Register public projects with off-chain metadata
- Create **recurring funding streams** (per-second accrual, pause/resume/cancel, capped withdrawals)
- Create **payment splits** (shares summing to exactly 10,000 bps, deposit → distribute → claim)
- Donate to projects with transparent on-chain support history
- Explore funded projects, track streams, splits, and full activity history

## Architecture

```
contracts/            Rust + Soroban (Stellar's smart-contract platform)
├── funding_stream/   per-second streams: create, pause, resume, cancel, withdraw
├── splitter/         shares summing to 10,000 bps: create, deposit, distribute, claim
├── registry/         public project registry + on-chain support history
└── token_vault/      reusable escrow primitive (deposit / withdraw / ownership)

src/                  TypeScript + React web app
├── convex/           Convex backend (schema, queries, mutations, seed data)
├── pages/            Landing, Explore, ProjectDetail, Dashboard, Streams, Splitter, ...
├── components/       shadcn/ui components, wallet + project + stream + split UI
└── lib/              shared Stellar formatting + stream math (mirrors the contracts)
```

The web app runs against a **Convex-backed simulation** of the contracts so the whole product
can be explored without a wallet — same math, same rules, same ledger. The real contracts in
`contracts/` are deployable with the Soroban CLI and are the source of truth.

## The contracts

| Contract | Purpose | Key functions |
| --- | --- | --- |
| `funding_stream` | Escrow `total_amount` of a token, release it to the recipient per-second; sender pauses/resumes/cancels, recipient withdraws up to the claimable balance | `create_stream`, `pause_stream`, `resume_stream`, `cancel_stream`, `withdraw`, `claimable_balance`, `stream_details` |
| `splitter` | Hold deposits and fan them out proportionally; shares validated to sum to 10,000 bps; edits locked while funds are pending | `create_split`, `update_split`, `deposit`, `distribute`, `claim`, `remove_recipient` |
| `registry` | Public project directory; only bounded metadata on-chain, rich profiles behind `metadata_uri`; donations transfer supporter → project wallet directly and are recorded on-chain | `register_project`, `update_project`, `set_project_active`, `project_details`, `my_projects`, `list_projects`, `support_project`, `support_history` |
| `token_vault` | Per-(owner, token) custody box; anyone deposits, only the owner withdraws | `create_vault`, `deposit`, `withdraw`, `transfer_ownership`, `vault_details`, `vault_balance` |

Security discipline across all four: every state change authenticates the caller with
`Address::require_auth`, all token movement goes through the Stellar token interface,
balances are updated **before** transfers (checks-effects-interactions), arithmetic uses
checked `i128` operations, and the release profile keeps overflow panics enabled.

## Web app routes

| Route | Description |
| --- | --- |
| `/` | Landing page |
| `/explore` | Explore funded projects |
| `/project/:slug` | Project details, supporters, funding history |
| `/dashboard` | User dashboard (protected) |
| `/streams` | Create and manage funding streams |
| `/splitter` | Create and manage payment splits |
| `/activity` | Incoming/outgoing payment history |
| `/docs` | Developer documentation |
| `/about` | About the project |

## Getting started

```bash
bun install          # install dependencies
bun run dev          # start the Vite dev server (managed by the platform preview)
bun tsc -b --noEmit  # typecheck
bun vitest run       # frontend unit tests (stream math + Stellar helpers)
```

The project is pre-configured with `CONVEX_DEPLOYMENT` / `VITE_CONVEX_URL` for the Convex
backend and runs on a managed dev environment. Convex Auth is set up (email OTP + anonymous).

## Contracts: build, test, deploy

```bash
cd contracts
cargo test --workspace                                     # unit + integration tests
cargo build --workspace --release --target wasm32-unknown-unknown   # deployable Soroban wasm

# deploy to Stellar Testnet with the Soroban CLI
soroban keys generate alice --network testnet
soroban keys fund alice --network testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/funding_stream.wasm \
  --source alice --network testnet
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR:

- **contracts** — Rust build, full `cargo test --workspace`, and a release wasm build
- **frontend** — `bun tsc -b --noEmit` and `bun vitest run`

## Docker

Reproducible environments for both halves of the repo:

```bash
docker compose up --build    # web (http://localhost:5173) + contracts (runs cargo test)
```

- Root `Dockerfile` — multi-stage build of the web app (Bun → static assets, served with `vite preview`). Pass `--build-arg VITE_CONVEX_URL=...` or set it in a `.env` file.
- `contracts/Dockerfile` — pinned Rust toolchain that builds the wasm and runs the full test suite, so every contributor sees identical results.

## Environment variables

- `VITE_CONVEX_URL` / `CONVEX_DEPLOYMENT` — Convex client/deployment URLs (already set in this environment)
- Convex server env: `JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL` (auth)

---

# Contributor conventions

## Using Authentication

- All Convex auth functions are already set up (email OTP + anonymous).
- **Do not modify** `src/convex/auth/emailOtp.ts`, `src/convex/auth.config.ts`, or `src/convex/auth.ts`.
- Backend: use `getCurrentUser` from `src/convex/users.ts` for the current user's data.
- Frontend: always use the `useAuth` hook from `@/hooks/use-auth`:

```typescript
import { useAuth } from "@/hooks/use-auth";
const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

- The `/auth` page handles all log in / sign up. Protected routes are wrapped with
  `RequireAuth`, which sends signed-out users to `/auth?returnTo=<route>`.
- The `/auth` route redirects to `/dashboard` after a successful sign-in (a validated
  same-origin `returnTo` takes priority).
- Authorize at the base level in both the frontend and the Convex queries/mutations.

## Frontend conventions

- Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Pages live in `src/pages`,
  components in `src/components`, shadcn primitives in `src/components/ui`.
- Mobile responsive layouts, `cursor-pointer` on clickable elements, no nested cards,
  no shadows, spinner (`loader2`) instead of skeletons, toasts via `sonner`, dialogs for
  forms, `tracking-tight font-bold` for titles.
- Animate with Framer Motion; keep the app-wide theme in `src/index.css` (oklch tokens).
- Sidebars for protected dashboard pages, navbars for public pages, clickable logo → `/`.

## Convex backend conventions

- Schema lives in `src/convex/schema.ts` (`schemaValidation: false`). Don't hand-edit
  `src/convex/_generated/*`; run `bun convex dev --once` to regenerate.
- External connections belong in Convex actions with `use node` at the top of the file.
- Use `@/convex/...` import paths, `Id<"Table">` for document IDs, `Doc<"Table">` for
  documents, and handle null/undefined on every query result. Never use return type
  validators.
