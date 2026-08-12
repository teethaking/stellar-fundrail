---
title: "Add unit tests for the split share editor math"
labels: ["frontend", "testing"]
area: frontend
difficulty: medium
size: s
---

## Summary

`SplitShareEditor` lets users adjust recipient shares in a split. The on-chain rule is that
shares must sum to exactly 10,000 basis points, and the UI enforces this in JavaScript —
but that math has no unit tests. Extract the pure share logic into a testable function and
cover it.

## Files

- `src/components/splits/SplitShareEditor.tsx`
- New test file `src/lib/split-math.ts` + `src/lib/split-math.test.ts` (extract the math)

## Acceptance criteria

- [ ] Pure helpers exist for: summing basis points, validating the sum equals 10_000,
      normalizing (re-scaling) shares after a change, and computing a recipient's allocation
      from a deposit
- [ ] Tests cover: exact sums, under/over sums, single-recipient splits, normalization
      rounding (remainder goes somewhere deterministic), zero and negative guards
- [ ] `SplitShareEditor` uses the extracted helpers (no behavior change)
- [ ] Tests run under `bun vitest run` and pass

## Notes

Mirror the invariants documented in `contracts/splitter/src/lib.rs` so the frontend and
contract agree — this is a smaller version of the parity goal in issue #015.
