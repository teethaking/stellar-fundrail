---
title: "Add clippy with -D warnings to the contracts CI job"
labels: ["good first issue", "tooling", "ci"]
area: repo
difficulty: easy
size: xs
---

## Summary

Add a Clippy lint step to the contracts CI job so warnings become errors and every PR is
lint-clean.

## Files

- `.github/workflows/ci.yml` (the `contracts` job)

## Acceptance criteria

- [ ] A step runs `cargo clippy --workspace --all-targets -- -D warnings`
- [ ] Any existing clippy warnings are fixed as part of this PR (or documented with an
      `#[allow]` plus a comment explaining why)
- [ ] The step runs after `cargo build` and before `cargo test`

## Notes

Keep the workspace release-profile settings (overflow checks, small wasm) untouched — if a
lint conflicts with an intentional design choice, prefer a scoped `#[allow(...)]` with a
comment over changing the profile.
