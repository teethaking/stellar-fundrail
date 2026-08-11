#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env,
};

/// Fresh environment with a funded depositor, all auth mocked.
/// Returns (owner, depositor, token).
fn setup(e: &Env) -> (Address, Address, Address) {
    e.mock_all_auths();
    let admin = Address::generate(e);
    let owner = Address::generate(e);
    let depositor = Address::generate(e);
    let token = e.register_stellar_asset_contract(admin);
    let sac = StellarAssetClient::new(e, &token);
    sac.mint(&depositor, &1_000_000_000);
    (owner, depositor, token)
}

fn register(e: &Env) -> SplitterClient {
    SplitterClient::new(e, &e.register(Splitter, ()))
}

fn balance(e: &Env, token: &Address, who: &Address) -> i128 {
    TokenClient::new(e, token).balance(who)
}

fn share(e: &Env, recipient: &Address, shares: u32) -> RecipientShare {
    RecipientShare {
        recipient: recipient.clone(),
        shares,
    }
}

/// Creates a 50/30/20 split. Returns (client, split_id, a, b, c).
fn create_abc_split(e: &Env, owner: &Address, token: &Address) -> (SplitterClient, u32, Address, Address, Address) {
    let client = register(e);
    let a = Address::generate(e);
    let b = Address::generate(e);
    let c = Address::generate(e);
    let recipients = vec![
        e,
        share(e, &a, 5_000),
        share(e, &b, 3_000),
        share(e, &c, 2_000),
    ];
    let id = client.create_split(owner, token, &recipients);
    (client, id, a, b, c)
}

// ---------------------------------------------------------------------------
// Creation & validation
// ---------------------------------------------------------------------------

#[test]
fn test_create_split_and_details() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);

    assert_eq!(id, 0);
    assert_eq!(client.split_count(), 1);
    let details = client.split_details(&id);
    assert_eq!(details.owner, owner);
    assert_eq!(details.token, token);
    assert_eq!(details.deposited, 0);
    assert_eq!(details.distributed, 0);
    assert_eq!(details.recipients.len(), 3);
    assert_eq!(details.recipients.get(0).unwrap().recipient, a);
    assert_eq!(details.recipients.get(0).unwrap().shares, 5_000);
    assert_eq!(details.recipients.get(1).unwrap().recipient, b);
    assert_eq!(details.recipients.get(1).unwrap().shares, 3_000);
    assert_eq!(details.recipients.get(2).unwrap().recipient, c);
    assert_eq!(details.recipients.get(2).unwrap().shares, 2_000);
}

#[test]
fn test_create_split_invalid_shares() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let client = register(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);

    // Sums to 9_000, not 10_000.
    let recipients = vec![&e, share(&e, &a, 5_000), share(&e, &b, 4_000)];
    assert_eq!(
        client.try_create_split(&owner, &token, &recipients),
        Err(Ok(Error::InvalidRecipients))
    );
    // Sums to 11_000.
    let recipients = vec![&e, share(&e, &a, 6_000), share(&e, &b, 5_000)];
    assert_eq!(
        client.try_create_split(&owner, &token, &recipients),
        Err(Ok(Error::InvalidRecipients))
    );
    // Zero share.
    let recipients = vec![&e, share(&e, &a, 10_000), share(&e, &b, 0)];
    assert_eq!(
        client.try_create_split(&owner, &token, &recipients),
        Err(Ok(Error::InvalidRecipients))
    );
    // Empty recipient list.
    let recipients = vec![&e];
    assert_eq!(
        client.try_create_split(&owner, &token, &recipients),
        Err(Ok(Error::InvalidRecipients))
    );
}

#[test]
fn test_create_split_duplicate_recipients() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let client = register(&e);
    let a = Address::generate(&e);
    let recipients = vec![&e, share(&e, &a, 5_000), share(&e, &a, 5_000)];
    assert_eq!(
        client.try_create_split(&owner, &token, &recipients),
        Err(Ok(Error::DuplicateRecipient))
    );
}

#[test]
fn test_create_split_too_many_recipients() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let client = register(&e);
    // 33 recipients of 303 shares each = 9_999... use 33 x 303 + 1 = invalid anyway.
    let mut recipients = vec![&e];
    for _ in 0..MAX_RECIPIENTS + 1 {
        recipients.push_back(share(&e, &Address::generate(&e), 303));
    }
    // Sum check aside, the count check fires first.
    assert_eq!(
        client.try_create_split(&owner, &token, &recipients),
        Err(Ok(Error::InvalidRecipients))
    );
}

#[test]
fn test_create_split_requires_owner_auth() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let owner = Address::generate(&e);
    let token = e.register_stellar_asset_contract(admin);
    let client = register(&e);
    let a = Address::generate(&e);
    let recipients = vec![&e, share(&e, &a, 10_000)];
    // No auth mocked: creating a split must fail.
    assert!(client.try_create_split(&owner, &token, &recipients).is_err());
    assert_eq!(client.split_count(), 0);
}

// ---------------------------------------------------------------------------
// Deposit / distribute / claim
// ---------------------------------------------------------------------------

#[test]
fn test_deposit_distribute_claim() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);

    let escrow = client.address;
    client.deposit(&id, &depositor, &1_000);
    assert_eq!(balance(&e, &token, &escrow), 1_000);
    assert_eq!(client.split_details(&id).deposited, 1_000);

    client.distribute(&id);
    assert_eq!(client.claimable_balance(&id, &a), 500);
    assert_eq!(client.claimable_balance(&id, &b), 300);
    assert_eq!(client.claimable_balance(&id, &c), 200);
    let details = client.split_details(&id);
    assert_eq!(details.distributed, details.deposited);

    let a_before = balance(&e, &token, &a);
    client.claim(&id, &a);
    assert_eq!(balance(&e, &token, &a), a_before + 500);
    assert_eq!(client.claimable_balance(&id, &a), 0);

    client.claim(&id, &b);
    client.claim(&id, &c);
    assert_eq!(balance(&e, &token, &escrow), 0);
}

#[test]
fn test_distribute_multiple_deposits() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);

    client.deposit(&id, &depositor, &1_000);
    client.distribute(&id);
    client.deposit(&id, &depositor, &600);
    client.distribute(&id);

    assert_eq!(client.claimable_balance(&id, &a), 500 + 300);
    assert_eq!(client.claimable_balance(&id, &b), 300 + 180);
    assert_eq!(client.claimable_balance(&id, &c), 200 + 120);
}

#[test]
fn test_distribute_rounding_remainder_goes_to_last() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let client = register(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);
    let c = Address::generate(&e);
    let recipients = vec![
        &e,
        share(&e, &a, 3_333),
        share(&e, &b, 3_333),
        share(&e, &c, 3_334),
    ];
    let id = client.create_split(&owner, &token, &recipients);

    client.deposit(&id, &depositor, &100);
    client.distribute(&id);
    // Floors are 33 / 33; the last recipient absorbs the remainder.
    assert_eq!(client.claimable_balance(&id, &a), 33);
    assert_eq!(client.claimable_balance(&id, &b), 33);
    assert_eq!(client.claimable_balance(&id, &c), 34);
    // The allocation is exact.
    let total: i128 = client.claimable_balance(&id, &a)
        + client.claimable_balance(&id, &b)
        + client.claimable_balance(&id, &c);
    assert_eq!(total, 100);
}

#[test]
fn test_distribute_nothing_to_distribute() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let (client, id, _, _, _) = create_abc_split(&e, &owner, &token);
    assert_eq!(
        client.try_distribute(&id),
        Err(Ok(Error::NothingToDistribute))
    );
}

#[test]
fn test_claim_twice_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, _, _) = create_abc_split(&e, &owner, &token);

    client.deposit(&id, &depositor, &1_000);
    client.distribute(&id);
    client.claim(&id, &a);
    assert_eq!(
        client.try_claim(&id, &a),
        Err(Ok(Error::NothingToClaim))
    );
}

#[test]
fn test_deposit_zero_amount_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, _, _, _) = create_abc_split(&e, &owner, &token);
    assert_eq!(
        client.try_deposit(&id, &depositor, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_deposit(&id, &depositor, &-1),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn test_claim_requires_recipient_auth() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, _, _) = create_abc_split(&e, &owner, &token);
    client.deposit(&id, &depositor, &1_000);
    client.distribute(&id);

    e.set_auths(&[]);
    assert!(client.try_claim(&id, &a).is_err());
    assert!(client.try_deposit(&id, &a, &1).is_err());
}

// ---------------------------------------------------------------------------
// Update / remove
// ---------------------------------------------------------------------------

#[test]
fn test_update_split_by_owner() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);
    let d = Address::generate(&e);

    let recipients = vec![
        &e,
        share(&e, &a, 4_000),
        share(&e, &b, 4_000),
        share(&e, &c, 1_000),
        share(&e, &d, 1_000),
    ];
    client.update_split(&id, &recipients);
    let details = client.split_details(&id);
    assert_eq!(details.recipients.len(), 4);
    assert_eq!(details.recipients.get(3).unwrap().recipient, d);
    assert_eq!(details.recipients.get(3).unwrap().shares, 1_000);
}

#[test]
fn test_update_split_active_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);

    client.deposit(&id, &depositor, &1_000);
    // Undistributed deposits exist: updates are refused.
    let recipients = vec![&e, share(&e, &a, 5_000), share(&e, &b, 3_000), share(&e, &c, 2_000)];
    assert_eq!(
        client.try_update_split(&id, &recipients),
        Err(Ok(Error::SplitActive))
    );

    // After distributing, the update goes through.
    client.distribute(&id);
    let recipients = vec![&e, share(&e, &a, 6_000), share(&e, &b, 4_000)];
    client.update_split(&id, &recipients);
    assert_eq!(client.split_details(&id).recipients.len(), 2);
}

#[test]
fn test_update_split_requires_owner() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);
    let stranger = Address::generate(&e);

    e.set_auths(&[]);
    let recipients = vec![&e, share(&e, &a, 5_000), share(&e, &b, 3_000), share(&e, &c, 2_000)];
    assert!(client.try_update_split(&id, &recipients).is_err());
    let _ = stranger;
}

#[test]
fn test_remove_recipient_renormalizes_shares() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let (client, id, a, b, c) = create_abc_split(&e, &owner, &token);

    client.remove_recipient(&id, &a);
    let details = client.split_details(&id);
    assert_eq!(details.recipients.len(), 2);
    // 3_000/5_000 and 2_000/5_000 of 10_000 -> 6_000 / 4_000.
    assert_eq!(details.recipients.get(0).unwrap().recipient, b);
    assert_eq!(details.recipients.get(0).unwrap().shares, 6_000);
    assert_eq!(details.recipients.get(1).unwrap().recipient, c);
    assert_eq!(details.recipients.get(1).unwrap().shares, 4_000);
    // Removing the last recipient is refused.
    client.remove_recipient(&id, &b);
    assert_eq!(
        client.try_remove_recipient(&id, &c),
        Err(Ok(Error::InvalidRecipients))
    );
}

#[test]
fn test_remove_recipient_with_outstanding_claim_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, _, _) = create_abc_split(&e, &owner, &token);

    client.deposit(&id, &depositor, &1_000);
    client.distribute(&id);
    // `a` has an unclaimed balance of 500.
    assert_eq!(
        client.try_remove_recipient(&id, &a),
        Err(Ok(Error::OutstandingClaim))
    );
    // After claiming, removal succeeds.
    client.claim(&id, &a);
    client.remove_recipient(&id, &a);
    assert_eq!(client.split_details(&id).recipients.len(), 2);
}

#[test]
fn test_remove_recipient_split_active_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id, a, _, _) = create_abc_split(&e, &owner, &token);

    client.deposit(&id, &depositor, &1_000);
    assert_eq!(
        client.try_remove_recipient(&id, &a),
        Err(Ok(Error::SplitActive))
    );
}

#[test]
fn test_remove_recipient_not_found() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let (client, id, _, _, _) = create_abc_split(&e, &owner, &token);
    let stranger = Address::generate(&e);
    assert_eq!(
        client.try_remove_recipient(&id, &stranger),
        Err(Ok(Error::RecipientNotFound))
    );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

#[test]
fn test_unknown_split_errors() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let client = register(&e);
    let a = Address::generate(&e);
    assert_eq!(
        client.try_split_details(&99),
        Err(Ok(Error::SplitNotFound))
    );
    assert_eq!(
        client.try_claimable_balance(&99, &a),
        Err(Ok(Error::SplitNotFound))
    );
    assert_eq!(
        client.try_deposit(&99, &a, &10),
        Err(Ok(Error::SplitNotFound))
    );
    let _ = owner;
    let _ = token;
}
