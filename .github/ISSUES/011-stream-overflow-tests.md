---
title: "funding_stream: add extreme-value and overflow regression tests"
labels: ["contracts", "rust", "testing"]
area: contracts
difficulty: medium
size: s
---

## Summary

The stream math (`rate * elapsed` with `u128` intermediates) is overflow-safe by
construction, but there are no tests that exercise amounts near `i128::MAX`. Add a test suite
that pushes the contract to its limits and asserts it fails gracefully.

## Files

- `contracts/funding_stream/src/test.rs`

## Cases to cover

- [ ] `total_amount` near `i128::MAX` with a short window: creation succeeds, accrual caps at
      `total_amount`, `claimable_balance` never exceeds it
- [ ] `total_amount = i128::MAX`, very long window: rate floors to a safe value
- [ ] Withdrawing the full balance twice is rejected (`OverWithdrawal`)
- [ ] `create_stream` with `total_amount` such that `rate * (end - start)` would overflow a
      `u128` intermediate (should be impossible via the validation path — assert it cannot be
      constructed)
- [ ] Timestamps at `u64::MAX` boundaries are rejected cleanly (`InvalidTimestamps`)

## Acceptance criteria

- [ ] New tests pass alongside the existing suite
- [ ] No production code changes unless a real bug is found (that's the point — prove the math holds)

## Notes

The workspace release profile has `overflow-checks = true`, so any latent overflow would
panic rather than wrap; these tests should demonstrate that the checked arithmetic is
reachable-proof.
