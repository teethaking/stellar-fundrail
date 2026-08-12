---
title: "Add unit tests for the Convex stream/split mutation math"
labels: ["backend", "testing"]
area: backend
difficulty: medium
size: s
---

## Summary

The Convex mutations in `src/convex/streams.ts` and `src/convex/splits.ts` implement the
same business rules as the Rust contracts (validation, rate derivation, share math), but
there is no test coverage. Add tests that exercise the pure rules and, where feasible, the
mutations against an in-memory Convex test harness.

## Files

- `src/convex/streams.ts`, `src/convex/splits.ts` (extract pure helpers if needed)
- New test files (e.g. `src/convex/streams.test.ts`) — keep them out of the Convex runtime
  graph (the `convex/` dir is bundled; place tests in `src/lib` or a `tests/` folder if the
  bundler objects)

## Acceptance criteria

- [ ] Pure helpers for rate derivation and claimable math are extracted and unit-tested
      (can reuse `src/lib/stream-math.ts` — verify the mutations actually call it)
- [ ] If using the Convex test client (`convex` package utilities), cover: create stream
      validation errors, pause/resume/cancel state transitions, split share validation
- [ ] If the test harness is too heavy for the first pass, test the extracted helpers and
      document what remains untested
- [ ] `bun vitest run` passes

## Notes

The goal is parity confidence: these tests should encode the same invariants as the Rust
suite (see `contracts/*/src/test.rs`) — a backend bug caught here is a bug not shipped.
