#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

/// Fresh environment with a funded depositor and a token, all auth mocked.
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

fn register(e: &Env) -> TokenVaultClient {
    TokenVaultClient::new(e, &e.register(TokenVault, ()))
}

fn balance(e: &Env, token: &Address, who: &Address) -> i128 {
    TokenClient::new(e, token).balance(who)
}

/// Creates a vault and deposits `amount` from `depositor`. Returns (client, id).
fn create_funded_vault(e: &Env, owner: &Address, depositor: &Address, token: &Address, amount: i128) -> (TokenVaultClient, u32) {
    let client = register(e);
    e.ledger().set_timestamp(1_000);
    let id = client.create_vault(owner, token);
    client.deposit(&id, depositor, &amount);
    (client, id)
}

// ---------------------------------------------------------------------------
// Creation & reads
// ---------------------------------------------------------------------------

#[test]
fn test_create_vault_and_details() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let client = register(&e);

    e.ledger().set_timestamp(1_000);
    let id = client.create_vault(&owner, &token);
    assert_eq!(id, 0);
    assert_eq!(client.vault_count(), 1);

    let details = client.vault_details(&id);
    assert_eq!(details.owner, owner);
    assert_eq!(details.token, token);
    assert_eq!(details.balance, 0);
    assert_eq!(details.created_at, 1_000);

    let id2 = client.create_vault(&owner, &token);
    assert_eq!(id2, 1);
    assert_eq!(client.vault_count(), 2);
}

#[test]
fn test_create_vault_requires_auth() {
    let e = Env::default();
    let (owner, _, token) = setup(&e);
    let client = register(&e);
    // Disable auth mocking: an unsigned vault creation must fail.
    e.set_auths(&[]);
    assert!(client.try_create_vault(&owner, &token).is_err());
    assert_eq!(client.vault_count(), 0);
}

// ---------------------------------------------------------------------------
// Deposit / withdraw
// ---------------------------------------------------------------------------

#[test]
fn test_deposit_moves_funds_and_tracks_balance() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let client = register(&e);
    let id = client.create_vault(&owner, &token);

    let depositor_before = balance(&e, &token, &depositor);
    client.deposit(&id, &depositor, &2_500);
    assert_eq!(balance(&e, &token, &client.address), 2_500);
    assert_eq!(balance(&e, &token, &depositor), depositor_before - 2_500);
    assert_eq!(client.vault_balance(&id), 2_500);
    assert_eq!(client.vault_details(&id).balance, 2_500);
}

#[test]
fn test_deposit_zero_amount_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let client = register(&e);
    let id = client.create_vault(&owner, &token);

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
fn test_withdraw_by_owner_to_any_address() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id) = create_funded_vault(&e, &owner, &depositor, &token, 1_000);
    let recipient = Address::generate(&e);

    let recipient_before = balance(&e, &token, &recipient);
    client.withdraw(&id, &owner, &recipient, &400);
    assert_eq!(balance(&e, &token, &recipient), recipient_before + 400);
    assert_eq!(client.vault_balance(&id), 600);

    // Withdraw the rest.
    client.withdraw(&id, &owner, &recipient, &600);
    assert_eq!(client.vault_balance(&id), 0);
    assert_eq!(balance(&e, &token, &client.address), 0);
}

#[test]
fn test_withdraw_over_balance_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id) = create_funded_vault(&e, &owner, &depositor, &token, 1_000);
    let recipient = Address::generate(&e);

    assert_eq!(
        client.try_withdraw(&id, &owner, &recipient, &1_001),
        Err(Ok(Error::OverWithdrawal))
    );
    assert_eq!(
        client.try_withdraw(&id, &owner, &recipient, &0),
        Err(Ok(Error::InvalidAmount))
    );
    // Balance untouched.
    assert_eq!(client.vault_balance(&id), 1_000);
}

#[test]
fn test_withdraw_by_non_owner_rejected() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id) = create_funded_vault(&e, &owner, &depositor, &token, 1_000);
    let stranger = Address::generate(&e);
    let recipient = Address::generate(&e);

    assert_eq!(
        client.try_withdraw(&id, &stranger, &recipient, &100),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(client.vault_balance(&id), 1_000);
}

#[test]
fn test_withdraw_requires_auth() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id) = create_funded_vault(&e, &owner, &depositor, &token, 1_000);
    let recipient = Address::generate(&e);

    e.set_auths(&[]);
    assert!(client.try_withdraw(&id, &owner, &recipient, &100).is_err());
    assert_eq!(client.vault_balance(&id), 1_000);
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

#[test]
fn test_transfer_ownership_moves_control() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id) = create_funded_vault(&e, &owner, &depositor, &token, 1_000);
    let new_owner = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.transfer_ownership(&id, &owner, &new_owner);
    assert_eq!(client.vault_details(&id).owner, new_owner);

    // The old owner can no longer withdraw.
    assert_eq!(
        client.try_withdraw(&id, &owner, &recipient, &100),
        Err(Ok(Error::Unauthorized))
    );
    // The new owner can.
    client.withdraw(&id, &new_owner, &recipient, &100);
    assert_eq!(client.vault_balance(&id), 900);
}

#[test]
fn test_transfer_ownership_requires_current_owner() {
    let e = Env::default();
    let (owner, depositor, token) = setup(&e);
    let (client, id) = create_funded_vault(&e, &owner, &depositor, &token, 1_000);
    let stranger = Address::generate(&e);
    let new_owner = Address::generate(&e);

    assert_eq!(
        client.try_transfer_ownership(&id, &stranger, &new_owner),
        Err(Ok(Error::Unauthorized))
    );
    assert_eq!(client.vault_details(&id).owner, owner);
}

// ---------------------------------------------------------------------------
// Unknown vaults
// ---------------------------------------------------------------------------

#[test]
fn test_unknown_vault_errors() {
    let e = Env::default();
    let (_, depositor, token) = setup(&e);
    let client = register(&e);
    let stranger = Address::generate(&e);

    assert_eq!(
        client.try_vault_details(&42),
        Err(Ok(Error::VaultNotFound))
    );
    assert_eq!(
        client.try_vault_balance(&42),
        Err(Ok(Error::VaultNotFound))
    );
    assert_eq!(
        client.try_deposit(&42, &depositor, &10),
        Err(Ok(Error::VaultNotFound))
    );
    assert_eq!(
        client.try_withdraw(&42, &stranger, &stranger, &10),
        Err(Ok(Error::VaultNotFound))
    );
}
