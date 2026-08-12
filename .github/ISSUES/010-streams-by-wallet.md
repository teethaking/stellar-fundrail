---
title: "funding_stream: add streams_by_sender / streams_by_recipient query helpers"
labels: ["contracts", "rust"]
area: contracts
difficulty: medium
size: s
---

## Summary

The `funding_stream` contract can only read streams by numeric id (`stream_details`). A dApp
needs to list a wallet's streams. Add persistent per-wallet indexes so callers can page
through all streams where an address is sender or recipient.

## Files

- `contracts/funding_stream/src/lib.rs`
- `contracts/funding_stream/src/test.rs`

## Proposed API

```rust
pub fn streams_by_sender(env: Env, sender: Address) -> Vec<u32>;
pub fn streams_by_recipient(env: Env, recipient: Address) -> Vec<u32>;
```

## Acceptance criteria

- [ ] `create_stream` appends the new id to both indexes
- [ ] Ids in indexes stay valid if a stream is cancelled (cancelled streams remain readable)
- [ ] Tests: indexes populate correctly, multiple streams per wallet, and a wallet with no
      streams returns an empty list
- [ ] TTL bumping follows the existing storage conventions
- [ ] All existing tests still pass

## Notes

Keep the Vec capped or document why it is not — unbounded per-wallet Vecs are the main design
trade-off here; consider a reasonable cap like the registry's `MAX_HISTORY`.
