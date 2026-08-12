---
title: "Accessibility pass: keyboard nav, focus management, and aria labels on dialogs and forms"
labels: ["good first issue", "frontend", "a11y"]
area: frontend
difficulty: medium
size: s
---

## Summary

The app relies on shadcn/Radix primitives (which are largely accessible out of the box), but
several custom interactions need a review: custom duration buttons in the stream dialog, tag
filters on Explore, wallet connect dropdown items, and any place where a div is used as a
button.

## Files

- `src/components/streams/CreateStreamDialog.tsx` (custom duration buttons)
- `src/pages/Explore.tsx` (tag filter buttons)
- `src/components/site/WalletButton.tsx`
- Audit the rest of `src/components` and `src/pages` for similar patterns

## Acceptance criteria

- [ ] All interactive custom elements are real `<button>`s or have `role="button"` +
      `tabIndex` + keyboard handlers
- [ ] Dialogs restore focus on close (Radix does this — verify)
- [ ] Form fields have associated `<Label>`s (spot-check every dialog)
- [ ] Icon-only controls have `aria-label`s
- [ ] A quick pass with a keyboard (tab through the landing page and one dialog) works

## Notes

Fix findings, don't just file them: this issue should ship the fixes it identifies. Keep
`cursor-pointer` on clickable elements per the repo conventions.
