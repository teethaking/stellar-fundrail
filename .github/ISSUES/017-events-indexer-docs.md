---
title: "Document contract events and an off-chain indexer pattern"
labels: ["documentation", "contracts"]
area: contracts
difficulty: medium
size: m
---

## Summary

All four contracts publish Soroban events (stream created/paused/cancelled, split
deposited/claimed, project supported, vault withdrawn, …), but there is no guide explaining
what each event means or how to build an off-chain indexer over them. Write a doc that turns
the event structs into a consumable API.

## Files

- New file: `docs/contract-events.md` (or a section in the existing `/docs` page)
- Sources of truth: the `#[contractevent]` structs in each `contracts/*/src/lib.rs`

## Acceptance criteria

- [ ] Every event across the four contracts is listed with its topics and data fields
- [ ] For each event: what it means, when it fires, and what an indexer should record
- [ ] A minimal indexer recipe: listen with a Soroban RPC events subscription, decode
      `data_format = "single-value"` payloads, and store into a DB (pseudocode is fine)
- [ ] Notes on reconstructing state from events vs. reading `*_details` view functions
- [ ] Link the doc from the `/docs` page and the README

## Notes

This is a documentation task. A great first version can be produced purely by reading the
contract sources; no code changes required.
