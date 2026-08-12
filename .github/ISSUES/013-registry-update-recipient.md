---
title: "registry: add update_recipient to change a project's funding wallet"
labels: ["contracts", "rust"]
area: contracts
difficulty: medium
size: s
---

## Summary

A project's `recipient` (funding wallet) is set at registration and cannot be changed. Add
`update_recipient(creator, project_id, new_recipient)` so a creator can move where support
payments land (e.g. after losing a key).

## Files

- `contracts/registry/src/lib.rs`
- `contracts/registry/src/test.rs`

## Proposed API

```rust
pub fn update_recipient(env: Env, creator: Address, project_id: u32, new_recipient: Address) -> Result<(), Error>;
```

## Acceptance criteria

- [ ] Only the project's creator may call it (`Unsupported`-style error otherwise, reuse
      `Error::Unauthorized`)
- [ ] The new recipient must be a valid change (reuse existing validation helpers; empty is
      not valid)
- [ ] An event (`ProjectRecipientUpdated`) is published with the old and new addresses
- [ ] `support_project` pays the **new** recipient immediately after the update
- [ ] Tests: happy path, non-creator rejected, no-auth rejected, unknown project rejected

## Notes

Consider a one-line entry in the support history or event log so donors can see wallet
changes — a comment in the issue describing your choice is welcome.
