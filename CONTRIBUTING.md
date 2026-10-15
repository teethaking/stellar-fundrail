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

## Testing locally with a Soroban standalone node

Testnet is fine for demos, but for contract work a local standalone network is faster and
gives you full ledger control — reset it on demand, keep contract IDs stable while you
iterate, and fund accounts without a faucet delay. Everything below runs in Docker; you
need no Stellar infrastructure account.

### Prerequisites

- **Docker** (Engine or Desktop)
- **Rust** 1.84+ via `rustup`
- **Stellar CLI** — the binary is `stellar` (older guides and issues may say `soroban`):

  ```bash
  brew install stellar-cli          # macOS / Linux via Homebrew
  # or, from crates.io:
  cargo install --locked stellar-cli
  ```

### 1. Start the local network

[`stellar/quickstart`](https://github.com/stellar/quickstart) bundles `stellar-core`,
Horizon, Soroban RPC and Friendbot in one container. `--local` starts a single-node
standalone network:

```bash
docker run --rm -it \
  -p 8000:8000 \
  --name stellar-local \
  stellar/quickstart:testing \
  --local \
  --enable-stellar-rpc
```

Leave this terminal running. The first start pulls the image and can take a couple of
minutes. (On older quickstart images the flag was `--standalone`; both start the same
single-node network.)

The container serves everything on host port **8000**:

| Service | URL |
| --- | --- |
| Soroban RPC | `http://localhost:8000/rpc` |
| Friendbot (faucet) | `http://localhost:8000/friendbot` |
| Horizon | `http://localhost:8000/` |

Wait until the RPC reports healthy before continuing (in a second terminal):

```bash
curl -s http://localhost:8000/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
# → {"jsonrpc":"2.0","id":1,"result":{"status":"READY"}}
```

### 2. Register the network with the CLI

```bash
stellar network add local \
  --rpc-url http://localhost:8000/rpc \
  --network-passphrase "Standalone Network ; February 2017"
```

The passphrase identifies the standalone network — copy it exactly, including the ` ; `.

### 3. Create and fund an identity

```bash
stellar keys generate alice
stellar keys fund alice --network local
```

If `keys fund` errors on your CLI version, hit the local faucet directly with the
identity's public address:

```bash
curl "http://localhost:8000/friendbot?addr=$(stellar keys address alice)"
```

### 4. Build the contracts

```bash
cd contracts
rustup target add wasm32-unknown-unknown   # the target this repo builds (CI + Dockerfile)
stellar contract build
```

`stellar contract build` wraps a release build of the whole workspace. Recent CLI versions
instead target `wasm32v1-none` (install it with `rustup target add wasm32v1-none`) — if the
build complains about a missing target, add the one your CLI asks for. Either way the
artifacts land in `target/<target>/release/*.wasm`, one per crate:
`funding_stream.wasm`, `splitter.wasm`, `registry.wasm`, `token_vault.wasm`.

No network needed yet: `cargo test --workspace` from `contracts/` runs the full Rust test
suite entirely offline.

### 5. Deploy to the local network

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/funding_stream.wasm \
  --source alice \
  --network local
```

The CLI prints the contract ID (`C…`). Keep it handy:

```bash
export STREAM_ID=C...   # paste the ID printed above
```

Redeploy after every contract change; repeat the same command with the other wasm files to
deploy the rest of the workspace.

### 6. Invoke a function

Smoke-test the deployment by reading the stream counter:

```bash
stellar contract invoke \
  --id "$STREAM_ID" \
  --source alice \
  --network local \
  -- \
  stream_count
# → 0
```

The `--` separates CLI flags from the contract call and its arguments. Write functions
need a funded sender — e.g. `funding_stream::create_stream` (timestamps are **seconds**
since the Unix epoch, and the call escrows tokens, so it also needs a deployed token
contract address):

```bash
stellar contract invoke \
  --id "$STREAM_ID" \
  --source alice \
  --network local \
  -- \
  create_stream \
  --sender alice \
  --recipient bob \
  --token $TOKEN_ID \
  --total_amount 36000000000 \
  --start_time $(date +%s) \
  --end_time $(($(date +%s) + 3600))
```

Then watch the live claimable balance grow on the **Streams** page of the web app once a
stream exists — the same accrual math the contract enforces.

### 7. Reset or stop

The standalone ledger is in-memory: press `Ctrl-C` in the container terminal and the
`--rm` flag removes it, wiping every contract, balance, and stream — restart from step 1
for a clean chain. If the container was stopped some other way, remove it with
`docker rm -f stellar-local`.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `curl` to `/rpc` fails or the CLI says connection refused | The container is still booting — wait and retry the `getHealth` check from step 1 |
| `keys fund` errors | Use the friendbot `curl` fallback in step 3 |
| Deploy fails with "wasm not found" | Run `stellar contract build` from `contracts/`, then check which target dir exists (`wasm32-unknown-unknown` vs `wasm32v1-none`) and use that path |
| Invoke fails with a simulation error | `start_time` must be ≥ the ledger's current time, `end_time` must be later, and `total_amount / duration` must round to at least 1 base unit per second — see `contracts/funding_stream/src/lib.rs` |
| Port 8000 already in use | Change `-p 8000:8000` to e.g. `-p 8010:8000` and update the `--rpc-url` and friendbot URLs to match |

Further reading: [Stellar RPC development guide](https://developers.stellar.org/docs/data/apis/rpc/admin-guide/development)
· [Stellar CLI manual](https://developers.stellar.org/docs/tools/cli/stellar-cli)
· [Quickstart](https://github.com/stellar/quickstart)

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
