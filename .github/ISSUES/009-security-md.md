---
title: "Write a SECURITY.md threat model for the contracts workspace"
labels: ["security", "documentation"]
area: contracts
difficulty: medium
size: m
---

## Summary

Each contract's module docs describe its security model in prose, but there is no single
threat model document. Write `contracts/SECURITY.md` that a reviewer can read before
touching the money-moving code.

## Files

- New file: `contracts/SECURITY.md`

## Acceptance criteria

- [ ] Documents the invariants that must never break (funds conserved per stream/split/vault;
      claimable balances derived from immutable params; no double-withdrawal)
- [ ] Covers each contract: who can call what, what is authenticated, what is assumed
- [ ] Lists explicit out-of-scope items (e.g. token contract bugs, admin key loss, frontend bugs)
- [ ] Links each invariant to the code that enforces it (function names)
- [ ] References the overflow protections (checked `i128`, `overflow-checks` release profile)

## Notes

Good reference: the module docs in `contracts/funding_stream/src/lib.rs`,
`contracts/splitter/src/lib.rs`, `contracts/registry/src/lib.rs`, and
`contracts/token_vault/src/lib.rs`. This is a documentation task — no behavior changes.
