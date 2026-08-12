# Contributing to FundRail

Thanks for wanting to contribute! FundRail is a public-goods funding platform built on Rust
+ Stellar Soroban, and the project is deliberately set up as a place to learn both — whether
you are new to smart contracts or a seasoned Web3 engineer.

## Getting assigned to an issue

The contributor backlog lives in two places:

1. **In this repo:** `.github/ISSUES/` — 30 issues, each with acceptance criteria, the
   relevant files, and difficulty/size labels. Review them before filing.
2. **On GitHub:** after the maintainer runs
   `bun run scripts/create-github-issues.mjs`, each becomes a real issue with labels.

To work on an issue:

1. Pick an issue tagged **`good first issue`** if you are new to the repo.
2. Comment on the issue: **"I'll take this"** (or similar).
3. The maintainer assigns it to you. Please don't start large PRs for issues you haven't
   claimed — this avoids two people working on the same thing.
4. Open a PR that closes the issue (`Closes #123`) and link it in the issue.

Stuck? Ask in the issue — discussion is expected. No question is too basic.

## Issue overview

| Area | Issues | Notes |
| --- | --- | --- |
| Repo & tooling | `001`–`008` | LICENSE, gitignore, meta tags, Dependabot, CI, theme toggle — mostly `good first issue` |
| Contracts (Rust) | `009`–`017` | SECURITY.md, query helpers, overflow tests, proptests, cross-contract tests, event docs |
| Frontend | `018`–`028` | Validation, claimable card, filters, charts, command palette, a11y, PWA, custom assets |
| Backend (Convex) | `029`–`030` | Mutation tests, seed data |

Each issue file lists the exact files to touch and acceptance criteria. If an issue is
missing context, say so in the issue — improving an issue is a contribution too.

## Setting up locally

```bash
bun install                     # frontend deps
bun run dev                     # Vite dev server
bun tsc -b --noEmit             # typecheck
bun vitest run                  # frontend unit tests

cd contracts
cargo test --workspace          # Rust contract tests (requires Rust toolchain)
```

For the full reproducible setup, see `docker-compose.yml` (web + contracts images) and the
**Contributor conventions** section of the README.

## Before opening a PR

- [ ] Run the frontend checks: `bun tsc -b --noEmit` and `bun vitest run`
- [ ] For contract changes: `cargo test --workspace` (and `cargo fmt`, `cargo clippy` if
      touching Rust)
- [ ] Keep changes focused — one issue per PR, unless the issues explicitly depend on each other
- [ ] Add or update tests where the acceptance criteria call for them
- [ ] Verify the UI in the preview for anything user-facing (mobile too)
- [ ] Write a PR description that summarizes what changed and why

## Code style

- TypeScript: React 19 + Tailwind v4 + shadcn/ui — follow the conventions in the README
  (no nested cards, no shadows, spinners over skeletons, toasts via `sonner`)
- Rust: `no_std` Soroban contracts with `Address::require_auth` on every state change,
  checked `i128` arithmetic, events on state changes, and a `test.rs` per contract
- Commit messages: short, imperative ("Add registry update_recipient", not "updates")

## Testing expectations

- Frontend logic gets Vitest tests in `src/lib/*.test.ts` (see `stream-math.test.ts`)
- Contract changes get tests in `contracts/*/src/test.rs` covering both happy paths and the
  failure modes (auth, over-withdrawal, double-claim, invalid input)
- CI (`.github/workflows/ci.yml`) runs all of it on every PR — make sure it's green

## Reporting a security issue

Do **not** open a public issue for security vulnerabilities in the contracts. Contact the
maintainers privately (or open a draft discussion) with the details. The contracts are an
experimental, unaudited reference implementation — see `contracts/SECURITY.md` once it lands
for the threat model.
