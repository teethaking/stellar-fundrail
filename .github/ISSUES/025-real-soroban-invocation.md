---
title: "Back simulated tx hashes with real Soroban Testnet invocation behind a feature flag"
labels: ["frontend", "contracts"]
area: frontend
difficulty: hard
size: l
---

## Summary

Every write in the app calls a Convex mutation that records a simulated tx hash
(`simulateTxHash` in `src/lib/stellar.ts`). Add an opt-in integration mode that builds and
submits real Soroban transactions against Testnet via Freighter (or a configured keypair) and
records the real tx hash instead.

## Files

- `src/lib/stellar.ts` / `src/hooks/use-wallet.ts`
- `src/convex/*` (mutations that currently accept a `txHash` from the client)
- New module for Soroban RPC calls (`@stellar/stellar-sdk` is installed)

## Acceptance criteria

- [ ] A clearly-labeled "Testnet mode" toggle (localStorage-persisted, off by default)
- [ ] In testnet mode, contract calls build and submit Soroban transactions (deploy the
      `funding_stream`/`splitter`/`registry`/`token_vault` contracts and store their ids)
- [ ] The real `txHash` from the submission replaces the simulated one in the Convex record
- [ ] Graceful degradation: RPC errors surface as toasts and the app stays usable in
      simulation mode
- [ ] Document the setup (RPC URL, testnet keys, deployed contract ids) in `/docs`

## Notes

This is the largest frontend issue on the board — a great capstone. Consider splitting the
first PR into "build the module + dry-run" and a second PR that flips the flag in the dialogs.
