---
title: "Add Open Graph / Twitter card meta tags to index.html"
labels: ["good first issue", "frontend"]
area: frontend
difficulty: easy
size: xs
---

## Summary

`index.html` has only a title, icon, manifest, and viewport. When links to FundRail are shared
on social platforms they render without a description or preview image. Add Open Graph and
Twitter card meta tags.

## Files

- `index.html`
- `public/logo.svg` (existing asset can be the fallback image; add a 1200×630 `public/og.png`
  if you want a proper card)

## Acceptance criteria

- [ ] `og:title`, `og:description`, `og:type` (`website`), `og:url`, `og:image` are present
- [ ] `twitter:card` (summary_large_image), `twitter:title`, `twitter:description` are present
- [ ] A description that reflects the product ("Decentralized public-goods funding on Stellar
      Soroban — streams, splits, and transparent project support")

## Notes

Keep the theme consistent with the existing dark/cyan design if you create a preview image.
