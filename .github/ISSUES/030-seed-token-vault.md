---
title: "Add token_vault demo data and a treasury section to the seed"
labels: ["good first issue", "backend"]
area: backend
difficulty: easy
size: s
---

## Summary

`src/convex/seed.ts` populates projects, streams, splits, and activities for the demo — but
not the token_vault concept. Add a couple of demo vaults (e.g. a community treasury with
deposits and withdrawals) and surface them in the dashboard so every contract has a visible
representation in the app.

## Files

- `src/convex/seed.ts` (add vault demo data — decide whether vaults need a Convex table or
  can be represented as activities/streams; prefer the smallest schema change)
- `src/pages/Dashboard.tsx` (a small "Treasury" panel if a table is added)
- `src/convex/schema.ts` (only if a `vaults` table is justified)

## Acceptance criteria

- [ ] Seed runs idempotently (no duplicate vaults on re-seed)
- [ ] Demo vault data is visible somewhere in the authenticated app (dashboard or /activity)
- [ ] If a `vaults` table is added: schema validation off, indexes per conventions, and the
      seed ties vaults to demo wallets already in use
- [ ] Typecheck and tests pass

## Notes

Keep it minimal: the token_vault contract is primarily a building block. A "community
treasury" row on the dashboard with deposit/withdraw history from the existing `activities`
ledger is the lowest-friction approach.
