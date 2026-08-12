---
title: "PWA polish: real app icons, theme color, and install experience"
labels: ["good first issue", "frontend"]
area: frontend
difficulty: easy
size: s
---

## Summary

`public/manifest.webmanifest` exists and `index.html` links it, but there are no real icon
files (192px / 512px PNGs) and no `theme_color`. Make the app properly installable as a PWA.

## Files

- `public/manifest.webmanifest`
- `public/logo.svg` (source for the icons — export 192×192 and 512×512 PNGs, or generate
  them from the SVG in the build)
- `index.html` (apple-touch-icon link)

## Acceptance criteria

- [ ] Manifest declares `icons` with 192px and 512px PNGs (purpose `any` and `maskable`)
- [ ] `theme_color` and `background_color` match the app's dark palette (`#04060B` is the
      footer/bg color; verify against `src/index.css`)
- [ ] `display: standalone` (or `minimal-ui`) with a sensible `start_url` (`/`)
- [ ] Lighthouse "installable" check passes on the landing page
- [ ] No broken asset references

## Notes

If generating PNGs from the SVG requires tooling you don't want to add, an inline base64
favicon is not acceptable for the manifest — commit real PNG files.
