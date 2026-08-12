---
title: "Validate GitHub/website URLs when registering a project"
labels: ["good first issue", "frontend"]
area: frontend
difficulty: easy
size: xs
---

## Summary

`RegisterProjectDialog` accepts any string for the GitHub repository and website fields.
Malformed URLs get stored and rendered as dead links. Validate them with a friendly inline
error before submitting.

## Files

- `src/components/projects/RegisterProjectDialog.tsx`

## Acceptance criteria

- [ ] GitHub field (when filled): must parse as an `https://github.com/<owner>/<repo>` URL
      (allow trailing slashes and `.git`)
- [ ] Website field (when filled): must parse as an `http(s)://` URL with a host
- [ ] Errors are shown inline next to the field, not only as a toast
- [ ] Empty fields remain valid (both are optional)
- [ ] Optionally: normalize stored values (strip trailing slash) and add a matching Convex
      validator in `src/convex/projects.ts` if feasible

## Notes

`new URL()` in the browser is enough — no extra dependency. Keep the validation consistent
with the existing Stellar-address check above the form.
