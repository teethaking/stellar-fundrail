#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

/// Fresh environment with a funded sender and a token, all auth mocked.
/// Returns (sender, recipient, token).
fn setup(e: &Env) -> (Address, Address, Address) {
    e.mock_all_auths();
    let admin = Address::generate(e);
    let sender = Address::generate(e);
    let recipient = Address::generate(e);
    let token = e.register_stellar_asset_contract(admin);
    let sac = StellarAssetClient::new(e, &token);
    sac.mint(&sender, &1_000_000_000);
    sac.mint(&recipient, &1_000_000_000);
    (sender, recipient, token)
}

fn register(e: &Env) -> FundingStreamClient {
    FundingStreamClient::new(e, &e.register(FundingStream, ()))
}

fn balance(e: &Env, token: &Address, who: &Address) -> i128 {
    TokenClient::new(e, token).balance(who)
}

/// Starts a 1,000-unit stream over 1,000 seconds (rate 1/sec) at t=1_000.
fn create_basic(e: &Env, client: &FundingStreamClient, sender: &Address, recipient: &Address, token: &Address) -> u32 {
    e.ledger().set_timestamp(1_000);
    client.create_stream(sender, recipient, token, &1_000_000, &1_000, &2_000)
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

#[test]
fn test_create_stream_and_details() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);

    let before = balance(&e, &token, &sender);
    let id = create_basic(&e, &client, &sender, &recipient, &token);
    assert_eq!(id, 0);
    assert_eq!(client.stream_count(), 1);

    // Escrow moved out of the sender's wallet.
    assert_eq!(balance(&e, &token, &sender), before - 1_000_000);
    assert_eq!(balance(&e, &token, &client.address), 1_000_000);

    let details = client.stream_details(&id);
    assert_eq!(details.sender, sender);
    assert_eq!(details.recipient, recipient);
    assert_eq!(details.token, token);
    assert_eq!(details.total_amount, 1_000_000);
    assert_eq!(details.rate, 1_000);
    assert_eq!(details.withdrawn, 0);
    assert_eq!(details.status, StreamStatus::Active);
    assert_eq!(details.paused_at, None);
    assert_eq!(details.paused_seconds, 0);
}

#[test]
fn test_stream_ids_increment() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);
    assert_eq!(create_basic(&e, &client, &sender, &a, &token), 0);
    assert_eq!(create_basic(&e, &client, &sender, &b, &token), 1);
    assert_eq!(client.stream_count(), 2);
}

#[test]
fn test_create_stream_requires_auth() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);
    let token = e.register_stellar_asset_contract(admin);
    // Mock auth only long enough to mint funds, then disable mocking so the
    // contract call runs with real (absent) authorization.
    e.mock_all_auths();
    StellarAssetClient::new(&e, &token).mint(&sender, &1_000_000_000);
    e.set_auths(&[]);

    let client = register(&e);
    e.ledger().set_timestamp(1_000);
    assert!(client
        .try_create_stream(&sender, &recipient, &token, &1_000_000, &1_000, &2_000)
        .is_err());
    // Nothing was moved and nothing was created.
    assert_eq!(client.stream_count(), 0);
}

#[test]
fn test_create_stream_zero_amount() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    e.ledger().set_timestamp(1_000);
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &0, &1_000, &2_000),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &-5, &1_000, &2_000),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn test_create_stream_self_stream() {
    let e = Env::default();
    let (sender, _, token) = setup(&e);
    let client = register(&e);
    e.ledger().set_timestamp(1_000);
    assert_eq!(
        client.try_create_stream(&sender, &sender, &token, &1_000_000, &1_000, &2_000),
        Err(Ok(Error::SelfStream))
    );
}

#[test]
fn test_create_stream_invalid_timestamps() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    e.ledger().set_timestamp(1_000);

    // start >= end
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &1_000_000, &2_000, &2_000),
        Err(Ok(Error::InvalidTimestamps))
    );
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &1_000_000, &2_000, &1_000),
        Err(Ok(Error::InvalidTimestamps))
    );
    // end <= now
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &1_000_000, &500, &1_000),
        Err(Ok(Error::InvalidTimestamps))
    );
    // start in the past
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &1_000_000, &999, &2_000),
        Err(Ok(Error::InvalidTimestamps))
    );
}

#[test]
fn test_create_stream_duration_too_long() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    e.ledger().set_timestamp(1_000);
    // 1 base unit over 1,000,000 seconds -> rate rounds to 0.
    assert_eq!(
        client.try_create_stream(&sender, &recipient, &token, &1, &1_000, &1_001_000),
        Err(Ok(Error::DurationTooLong))
    );
}

// ---------------------------------------------------------------------------
// Claimable balance & withdrawals
// ---------------------------------------------------------------------------

#[test]
fn test_claimable_grows_over_time() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.ledger().set_timestamp(1_000);
    assert_eq!(client.claimable_balance(&0), 0);
    e.ledger().set_timestamp(1_500);
    assert_eq!(client.claimable_balance(&0), 500_000);
    e.ledger().set_timestamp(2_000);
    assert_eq!(client.claimable_balance(&0), 1_000_000);
    // Past the end time the claimable balance is capped at the total.
    e.ledger().set_timestamp(10_000);
    assert_eq!(client.claimable_balance(&0), 1_000_000);
}

#[test]
fn test_withdraw_partial_and_full() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.ledger().set_timestamp(1_400);
    let before = balance(&e, &token, &recipient);
    client.withdraw(&0, &300_000);
    assert_eq!(balance(&e, &token, &recipient), before + 300_000);
    assert_eq!(client.claimable_balance(&0), 100_000);

    // Withdraw the rest.
    client.withdraw(&0, &100_000);
    assert_eq!(client.claimable_balance(&0), 0);
    let details = client.stream_details(&0);
    assert_eq!(details.withdrawn, 400_000);
}

#[test]
fn test_over_withdrawal_rejected() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.ledger().set_timestamp(1_500);
    assert_eq!(
        client.try_withdraw(&0, &500_001),
        Err(Ok(Error::OverWithdrawal))
    );
    // Zero and negative amounts are rejected too.
    assert_eq!(
        client.try_withdraw(&0, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_withdraw(&0, &-1),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn test_no_double_withdrawal() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.ledger().set_timestamp(2_000);
    client.withdraw(&0, &1_000_000);
    assert_eq!(client.claimable_balance(&0), 0);
    // A second withdrawal for any positive amount must fail.
    assert_eq!(
        client.try_withdraw(&0, &1),
        Err(Ok(Error::OverWithdrawal))
    );
    // The escrow is now empty.
    assert_eq!(balance(&e, &token, &client.address), 0);
}

#[test]
fn test_withdraw_requires_auth() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);
    e.ledger().set_timestamp(1_500);

    // Disable auth mocking: an unsigned withdrawal must fail.
    e.set_auths(&[]);
    assert!(client.try_withdraw(&0, &100_000).is_err());
}

#[test]
fn test_withdraw_from_unknown_stream() {
    let e = Env::default();
    let (_, recipient, _) = setup(&e);
    let client = register(&e);
    assert_eq!(
        client.try_withdraw(&42, &1),
        Err(Ok(Error::StreamNotFound))
    );
    assert_eq!(
        client.try_pause_stream(&42),
        Err(Ok(Error::StreamNotFound))
    );
    assert_eq!(
        client.try_stream_details(&42),
        Err(Ok(Error::StreamNotFound))
    );
}

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

#[test]
fn test_pause_freezes_accrual() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.ledger().set_timestamp(1_500);
    assert_eq!(client.claimable_balance(&0), 500_000);
    client.pause_stream(&0);
    assert_eq!(client.stream_details(&0).status, StreamStatus::Paused);

    // No accrual while paused.
    e.ledger().set_timestamp(1_800);
    assert_eq!(client.claimable_balance(&0), 500_000);

    client.resume_stream(&0);
    assert_eq!(client.stream_details(&0).status, StreamStatus::Active);

    // Accrual resumes from the paused point: 200s elapsed since resume.
    e.ledger().set_timestamp(2_000);
    assert_eq!(client.claimable_balance(&0), 700_000);
}

#[test]
fn test_pause_only_when_active() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    client.pause_stream(&0);
    assert_eq!(
        client.try_pause_stream(&0),
        Err(Ok(Error::InvalidStatus))
    );
    assert_eq!(
        client.try_resume_stream(&0),
        Ok(Ok(()))
    );
    // Resuming an already-active stream fails.
    assert_eq!(
        client.try_resume_stream(&0),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn test_pause_requires_sender_auth() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.set_auths(&[]);
    assert!(client.try_pause_stream(&0).is_err());
    assert!(client.try_resume_stream(&0).is_err());
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_pays_recipient_and_refunds_sender() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    let sender_before = balance(&e, &token, &sender);
    let recipient_before = balance(&e, &token, &recipient);

    e.ledger().set_timestamp(1_600);
    client.cancel_stream(&0);

    // Recipient earned 600k, sender got the remaining 400k back.
    assert_eq!(balance(&e, &token, &recipient), recipient_before + 600_000);
    assert_eq!(balance(&e, &token, &sender), sender_before + 400_000);
    // Escrow drained.
    assert_eq!(balance(&e, &token, &client.address), 0);

    let details = client.stream_details(&0);
    assert_eq!(details.status, StreamStatus::Cancelled);
    // Nothing further is claimable.
    assert_eq!(client.claimable_balance(&0), 0);
}

#[test]
fn test_cancel_before_start_refunds_everything() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    let sender_before = balance(&e, &token, &sender);
    e.ledger().set_timestamp(1_000);
    client.cancel_stream(&0);
    assert_eq!(balance(&e, &token, &sender), sender_before + 1_000_000);
    assert_eq!(balance(&e, &token, &client.address), 0);
}

#[test]
fn test_cancel_after_full_withdrawal_refunds_nothing() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    let sender_before = balance(&e, &token, &sender);
    e.ledger().set_timestamp(2_000);
    client.withdraw(&0, &1_000_000);
    client.cancel_stream(&0);
    // Everything was earned; nothing is refunded.
    assert_eq!(balance(&e, &token, &sender), sender_before);
    assert_eq!(balance(&e, &token, &client.address), 0);
}

#[test]
fn test_cancel_only_once() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    client.cancel_stream(&0);
    assert_eq!(
        client.try_cancel_stream(&0),
        Err(Ok(Error::InvalidStatus))
    );
    // Withdrawing after cancellation is rejected.
    assert_eq!(
        client.try_withdraw(&0, &1),
        Err(Ok(Error::InvalidStatus))
    );
}

#[test]
fn test_cancel_requires_sender_auth() {
    let e = Env::default();
    let (sender, recipient, token) = setup(&e);
    let client = register(&e);
    create_basic(&e, &client, &sender, &recipient, &token);

    e.set_auths(&[]);
    assert!(client.try_cancel_stream(&0).is_err());
}
