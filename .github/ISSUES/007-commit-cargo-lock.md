---
title: "Commit contracts/Cargo.lock for reproducible contract builds"
labels: ["good first issue", "tooling"]
area: repo
difficulty: easy
size: xs
---

## Summary

The `contracts/` workspace has no `Cargo.lock` committed. For reproducible builds of the
deployable Soroban wasm (and for Dependabot to detect updates), the lockfile should be
generated and committed.

## Files

- `contracts/Cargo.lock` (new, generated)

## Acceptance criteria

- [ ] Run `cargo generate-lockfile` (or any build) in `contracts/` and commit the resulting
      `Cargo.lock`
- [ ] Confirm the lockfile is not ignored by `.gitignore`
- [ ] CI still passes (`cargo test --workspace`)

## Notes

This is a workspace of application crates (not a library), so committing the lockfile is the
recommended practice. It also pins the `soroban-sdk` graph used by the CI and Docker images.
