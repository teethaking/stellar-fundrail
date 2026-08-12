---
title: "Ignore Cargo build artifacts (contracts/target) in .gitignore"
labels: ["good first issue", "tooling"]
area: repo
difficulty: easy
size: xs
---

## Summary

The Rust workspace in `contracts/` generates a `contracts/target/` directory on build that is
currently untracked but not ignored. Add it to `.gitignore` so build artifacts can never be
committed accidentally.

## Files

- `.gitignore`

## Acceptance criteria

- [ ] `contracts/target/` (and `**/target/`) is ignored
- [ ] Also ignore editor/OS noise that is commonly missing (optional: `.DS_Store`, `*.swp`)

## Notes

The root `.gitignore` currently covers `node_modules`, `dist`, `.env.local`, and
`src/convex/_generated`.
