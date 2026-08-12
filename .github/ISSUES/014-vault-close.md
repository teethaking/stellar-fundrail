---
title: "token_vault: add close_vault to refund the balance and retire a vault"
labels: ["contracts", "rust"]
area: contracts
difficulty: medium
size: s
---

## Summary

A vault can be drained via `withdraw` but there is no "close" operation: a vault with a
balance cannot be retired, and there is no on-chain record that a vault is done. Add
`close_vault(vault_id, owner)` that refunds the full balance to the owner and marks the vault
closed so further deposits are refused.

## Files

- `contracts/token_vault/src/lib.rs`
- `contracts/token_vault/src/test.rs`

## Proposed API

```rust
pub fn close_vault(env: Env, vault_id: u32, owner: Address) -> Result<(), Error>;
```

## Acceptance criteria

- [ ] Only the owner may close; the balance is transferred back to the owner in full
- [ ] A closed vault rejects further `deposit` and `withdraw` calls (`InvalidStatus`-style
      error — add a new error variant or reuse an existing one deliberately)
- [ ] `vault_details` exposes the closed flag so the frontend can render it
- [ ] Tests: close with balance refunds exactly the balance, close an empty vault, deposit
      after close rejected, non-owner rejected, double-close rejected

## Notes

Keep the checks-effects-interactions ordering: zero the balance before the transfer.
