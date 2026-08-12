---
title: "Show per-token balances and counts in the dashboard overview"
labels: ["frontend"]
area: frontend
difficulty: medium
size: s
---

## Summary

The dashboard aggregates totals across tokens, but streams and splits can be denominated in
USDC or XLM (and eventually custom assets). Add a per-token breakdown so users can see
"what's in USDC vs XLM" at a glance.

## Files

- `src/pages/Dashboard.tsx`
- `src/convex/streams.ts` / `src/convex/splits.ts` (data already includes `token`)

## Acceptance criteria

- [ ] Group the overview stats by token: streams (active count + outstanding value),
      splits (pending + claimable), and donations received
- [ ] Each group shows the token symbol and renders amounts with the token's decimals
      (see `formatUnits` / `USDC_TESTNET`)
- [ ] A token with zero activity is either shown as $0 or hidden — pick one and be consistent
- [ ] Existing total cards stay; the breakdown is additive, not a replacement

## Notes

All amounts are stored in base units with `token` as a symbol string — no schema change
needed. This pairs well with issue #019 (claimable card).
