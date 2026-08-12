---
title: "Project detail: add a supporter leaderboard and funding-over-time chart"
labels: ["frontend"]
area: frontend
difficulty: medium
size: m
---

## Summary

A project page should tell the story of who funds it and how funding has grown. Add a
supporter list (top supporters by total donated) and a funding-over-time chart to
`/project/:slug`, using the data already recorded in the activity ledger.

## Files

- `src/pages/ProjectDetail.tsx`
- `src/convex/projects.ts` / `src/convex/activities.ts` (aggregation query if needed)
- `src/components/ui/chart.tsx` (recharts is already installed and wrapped)

## Acceptance criteria

- [ ] Top supporters with amounts and share of total funding (sorted desc, capped at ~10)
- [ ] A line/area chart of cumulative funding over time (bucket by day/week depending on span)
- [ ] Loading and empty states for both sections
- [ ] Mobile responsive (chart scrolls or stacks, leaderboard stays readable)
- [ ] No new chart library — reuse the existing recharts wrapper

## Notes

Aggregate from `activities` where `projectId` matches and `type` is `donation`. If the query
gets heavy, add a dedicated Convex query with the aggregation done server-side.
