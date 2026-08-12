---
title: "Activity page: filter by type/direction and export as CSV"
labels: ["frontend"]
area: frontend
difficulty: medium
size: s
---

## Summary

`/activity` shows the full ledger but offers no way to slice it. Add filters (incoming vs
outgoing, activity type, token) and a CSV export of the filtered rows — useful for donors
who want a paper trail for public-goods contributions.

## Files

- `src/pages/Activity.tsx`
- `src/convex/activities.ts` (consider filter args on the query)

## Acceptance criteria

- [ ] Filter chips or a dropdown for `direction` (in / out) and `type` (donation, stream,
      split, …)
- [ ] Filtering happens client-side over the loaded page **or** server-side via the query —
      choose the approach that keeps the page responsive, and justify it in the PR
- [ ] CSV export includes: date, type, direction, amount, token, counterparty, tx hash
- [ ] Export button is disabled while the list is loading
- [ ] Existing empty/loading states still work with filters applied

## Notes

The activity schema already carries `direction`, `type`, `token`, `counterparty`, and
`txHash` — no backend schema change should be needed for the CSV shape.
