---
title: "Add a ⌘K command palette for navigating and searching projects"
labels: ["frontend"]
area: frontend
difficulty: medium
size: m
---

## Summary

Add a keyboard-driven command palette (⌘K / Ctrl+K) that lets users jump to pages and search
the project registry without touching the mouse. `cmdk` is already a dependency.

## Files

- New component under `src/components/` (e.g. `CommandPalette.tsx`)
- `src/components/site/SiteLayout.tsx` or `Navbar.tsx` (mount it)
- `src/pages/Explore.tsx` + `src/convex/projects.ts` (project search source)

## Acceptance criteria

- [ ] Opens with ⌘K / Ctrl+K and closes with Esc, focus trap works
- [ ] Commands: navigate to Explore, Dashboard, Streams, Splitter, Activity, Docs, About
- [ ] Searching a project name navigates to `/project/:slug` (reuse the existing list query;
      a search arg on `api.projects.list` is acceptable)
- [ ] Shows the connected wallet address as a copy-able row
- [ ] No layout shift, works on mobile (can be triggered from a search icon)

## Notes

`cmdk` ships with the shadcn `command` component (`src/components/ui/command.tsx`) — use that
wrapper rather than raw cmdk.
