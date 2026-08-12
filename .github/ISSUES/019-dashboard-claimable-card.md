---
title: "Add a 'Claimable now' summary card with a withdraw action to the dashboard"
labels: ["frontend"]
area: frontend
difficulty: medium
size: s
---

## Summary

The dashboard shows overview stats and recent activity, but there is no at-a-glance
"how much can I withdraw right now" number, even though the data exists (streams' claimable
balances and splits' pending amounts). Add a summary card that aggregates claimable amounts
and lets the user withdraw/claim with one action each.

## Files

- `src/pages/Dashboard.tsx`
- `src/lib/stream-math.ts` (`claimableAmount` already exists)
- `src/convex/streams.ts` / `src/convex/splits.ts` (withdraw/claim mutations)

## Acceptance criteria

- [ ] Card lists each claimable source (per stream, per split) with its amount and token
- [ ] A "Withdraw" / "Claim" button calls the existing mutation and refreshes state (Convex
      reactivity handles this automatically)
- [ ] Zero-claimable state shows a neutral empty message, not a dead button
- [ ] The card is mobile responsive and follows the existing card styling (no nested cards,
      no shadows)

## Notes

Use the wallet from `useWallet()` to scope the query; the Convex queries already index by
wallet address.
