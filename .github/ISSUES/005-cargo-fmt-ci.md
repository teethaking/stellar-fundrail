---
title: "Add cargo fmt --check to the contracts CI job"
labels: ["good first issue", "tooling", "ci"]
area: repo
difficulty: easy
size: xs
---

## Summary

The contracts CI job runs `cargo build` and `cargo test` but does not enforce formatting.
Add a `cargo fmt --check` step so every PR is guaranteed to be `rustfmt`-clean.

## Files

- `.github/workflows/ci.yml` (the `contracts` job)

## Acceptance criteria

- [ ] A step runs `cargo fmt --all -- --check` in the `contracts` working directory
- [ ] The repo currently passes the check (run `cargo fmt` locally first if needed)
- [ ] The step runs before the build/test steps so formatting failures fail fast

## Notes

The CI job already sets `defaults.run.working-directory: contracts`, so the step just needs
the `cargo fmt` invocation. This also documents the recommended contributor workflow:
`cargo fmt && cargo clippy --workspace -- -D warnings && cargo test --workspace`.
