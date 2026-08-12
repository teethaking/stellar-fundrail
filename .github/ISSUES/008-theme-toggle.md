---
title: "Add a light/dark theme toggle using next-themes"
labels: ["good first issue", "frontend"]
area: frontend
difficulty: medium
size: s
---

## Summary

The app is styled with Tailwind v4 oklch tokens in `src/index.css` that support both
`light` and `dark` variants, and `next-themes` is already installed — but there is no way
for users to switch themes. Add a theme toggle in the site navbar that persists the choice.

## Files

- `src/components/site/Navbar.tsx` (add the toggle)
- `src/main.tsx` (wrap the app in `ThemeProvider` if needed)
- `src/index.css` (verify both palettes render correctly)

## Acceptance criteria

- [ ] A sun/moon toggle appears in the navbar (desktop and mobile menu)
- [ ] The choice persists across reloads (`next-themes` default `localStorage` behavior)
- [ ] Light and dark palettes both look intentional (no unreadable text, no broken accents)
- [ ] The toggle respects the user's system preference on first visit

## Notes

`next-themes` v0.4 is in `package.json`. Use `attachClassName` + `class` on `html` so Tailwind
v4's `dark:` variants work, and keep the FundRail cyan accents coherent in both modes.
