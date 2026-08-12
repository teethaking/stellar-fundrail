---
title: "Add Dependabot configuration for Bun and Cargo dependencies"
labels: ["good first issue", "tooling"]
area: repo
difficulty: easy
size: xs
---

## Summary

Set up Dependabot so the JavaScript (Bun) and Rust (Cargo) dependency graphs are kept
up-to-date automatically.

## Files

- New file: `.github/dependabot.yml`

## Acceptance criteria

- [ ] `package-manager: npm` (Bun uses `package.json`/`bun.lock`) weekly, with the root directory
- [ ] `package-manager: cargo` weekly, with the `contracts/` directory
- [ ] Reasonable `open-pull-requests-limit` (e.g. 10) and labels (e.g. `dependencies`)
- [ ] Mention in a comment that PRs will be auto-labeled and need the CI green check before merge

## Notes

CI already runs both ecosystems, so every Dependabot PR will be validated by
`.github/workflows/ci.yml`.
