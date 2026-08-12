---
title: "Add a cross-contract integration test: splitter payout funds a funding stream"
labels: ["contracts", "testing"]
area: contracts
difficulty: hard
size: m
---

## Summary

Each contract is tested in isolation. Add an integration test in the workspace that wires
contracts together like production does: a splitter distributes funds to a recipient who
immediately opens a `funding_stream` to a maintainer, and the stream pays out.

## Files

- New test module in `contracts/` (e.g. `contracts/integration/` or a `tests/` crate)
- Reuses `contracts/splitter`, `contracts/funding_stream`, and a Stellar asset contract

## Flow to cover

1. Owner creates a split (A 50%, B 50%)
2. Depositor deposits 1,000 USDC; `distribute` allocates 500 / 500
3. A claims 500
4. A creates a funding stream of 400 to C with a time window
5. Time passes; C withdraws the accrued amount
6. Balances are conserved at every step (escrow + wallets sum to the original 1,000)

## Acceptance criteria

- [ ] Test compiles as part of the workspace and runs in CI
- [ ] Asserts conservation at each step, not just the final state
- [ ] Documents the addresses/tokens used in the test (readable failure messages)

## Notes

Use `Env::default()` with `mock_all_auths`, `e.register(...)` for each contract, and a single
`register_stellar_asset_contract` token. This test is the blueprint for the README's
"how it works end to end" section.
