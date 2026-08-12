---
title: "Support custom Stellar assets (token contract addresses) in streams and splits"
labels: ["frontend", "contracts"]
area: frontend
difficulty: hard
size: m
---

## Summary

Streams and splits hard-code `USDC` / `XLM` (see `SUPPORTED_TOKENS` in `src/lib/stellar.ts`).
Production Soroban flows pay in arbitrary token contracts. Add support for a user-supplied
Stellar asset: its SAC contract address or issuer, resolved to a symbol for display.

## Files

- `src/lib/stellar.ts` (`SUPPORTED_TOKENS`, token metadata)
- `src/components/streams/CreateStreamDialog.tsx` and `src/components/splits/CreateSplitDialog.tsx`
- `src/convex/streams.ts` / `src/convex/splits.ts` (token address field)
- Optionally `contracts/*` if token validation should move on-chain

## Acceptance criteria

- [ ] A "custom asset" option in the token selector that accepts a valid Stellar address or
      `CODE:ISSUER` pair and resolves decimals/symbol where possible
- [ ] Streams/splits store the resolved token identifier (address or code), and the UI
      renders it consistently
- [ ] Fallback gracefully when the asset cannot be resolved (default 7 decimals, show the raw
      identifier)
- [ ] Validation errors are inline and clear
- [ ] Existing USDC/XLM flows are unchanged

## Notes

`@stellar/stellar-sdk` is already installed and can look up assets on Horizon Testnet — but
the app currently simulates the chain, so a metadata table in `src/lib/stellar.ts` plus
validation is sufficient for this iteration.
