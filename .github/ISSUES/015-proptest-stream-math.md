---
title: "Proptest the Rust stream math against the TypeScript reference implementation"
labels: ["contracts", "testing"]
area: contracts
difficulty: hard
size: l
---

## Summary

The on-chain `funding_stream` accrual math and the frontend's `src/lib/stream-math.ts` are
meant to be identical, but nothing verifies that. Property-test the Rust implementation with
randomized stream parameters (times, rates, pauses) and assert the outputs match the TS
reference for the same inputs.

## Files

- `contracts/funding_stream/src/` (add a proptest module or dev-dependency)
- `src/lib/stream-math.ts` (reference — do not change behavior)
- Possibly a small golden-fixture generator script

## Acceptance criteria

- [ ] `proptest` (or `quickcheck`) is wired up as a dev-dependency with `testutils`
- [ ] Properties: claimable never exceeds `total_amount`; `claimable + withdrawn <= total`;
      paused windows accrue nothing; after `end_time` the claimable equals `total - withdrawn`
- [ ] A cross-language parity check: generate fixtures, compute expected values with the TS
      implementation, and assert the Rust contract matches for the same fixtures
- [ ] Runs in CI as part of `cargo test --workspace` (keep runtime reasonable — a few hundred
      cases)

## Notes

This is the strongest "the simulation matches the chain" evidence the repo can have. If the
TS and Rust disagree on an edge case, decide which is correct and fix the wrong one, and note
it in the PR.
