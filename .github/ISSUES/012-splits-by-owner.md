---
title: "splitter: add a splits_by_owner lookup helper"
labels: ["contracts", "rust"]
area: contracts
difficulty: medium
size: s
---

## Summary

The `splitter` contract numbers splits sequentially (`split_details(id)`), but there is no
way to list the splits an account owns. Add a `splits_by_owner(owner) -> Vec<u32>` helper so
the dashboard can render "my splits" without scanning every id.

## Files

- `contracts/splitter/src/lib.rs`
- `contracts/splitter/src/test.rs`

## Proposed API

```rust
pub fn splits_by_owner(env: Env, owner: Address) -> Vec<u32>;
```

## Acceptance criteria

- [ ] `create_split` records the id under the owner's index
- [ ] Multiple splits per owner are returned in creation order
- [ ] A wallet with no splits returns an empty Vec
- [ ] Tests cover the above, plus the owner-only invariant (the helper itself is read-only)
- [ ] Existing tests still pass

## Notes

Mirror the registry's `my_projects` pattern (`DataKey::CreatorProjects(Address) -> Vec<u32>`)
for consistency.
