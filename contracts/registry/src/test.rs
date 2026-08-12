#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

/// Fresh environment with a funded supporter and a token, all auth mocked.
/// Returns (creator, supporter, token).
fn setup(e: &Env) -> (Address, Address, Address) {
    e.mock_all_auths();
    let admin = Address::generate(e);
    let creator = Address::generate(e);
    let supporter = Address::generate(e);
    let token = e.register_stellar_asset_contract(admin);
    let sac = StellarAssetClient::new(e, &token);
    sac.mint(&supporter, &1_000_000_000);
    (creator, supporter, token)
}

fn register(e: &Env) -> RegistryClient {
    RegistryClient::new(e, &e.register(Registry, ()))
}

fn balance(e: &Env, token: &Address, who: &Address) -> i128 {
    TokenClient::new(e, token).balance(who)
}

/// Registers a project with default metadata; returns the project id.
fn register_basic(
    e: &Env,
    client: &RegistryClient,
    creator: &Address,
    recipient: &Address,
) -> u32 {
    e.ledger().set_timestamp(1_000);
    client.register_project(
        creator,
        &e.new_string("Soroban SDK"),
        &e.new_string("Rust SDK for Stellar Soroban"),
        &e.new_string("ipfs://QmSoroban"),
        recipient,
    )
}

// ---------------------------------------------------------------------------
// Registration & read paths
// ---------------------------------------------------------------------------

#[test]
fn test_register_project_and_details() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);

    let id = register_basic(&e, &client, &creator, &recipient);
    assert_eq!(id, 0);
    assert_eq!(client.project_count(), 1);

    let details = client.project_details(&id);
    assert_eq!(details.creator, creator);
    assert_eq!(details.recipient, recipient);
    assert_eq!(details.name, String::from_str(&e, "Soroban SDK"));
    assert_eq!(details.active, true);
    assert_eq!(details.total_supported, 0);
    assert_eq!(details.created_at, 1_000);
}

#[test]
fn test_my_projects_lists_creator_projects() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);

    assert_eq!(register_basic(&e, &client, &creator, &a), 0);
    assert_eq!(register_basic(&e, &client, &creator, &b), 1);

    let ids = client.my_projects(&creator);
    assert_eq!(ids.len(), 2);
    assert_eq!(ids.get(0).unwrap(), 0);
    assert_eq!(ids.get(1).unwrap(), 1);
    // An unrelated creator sees nothing.
    let stranger = Address::generate(&e);
    assert_eq!(client.my_projects(&stranger).len(), 0);
}

#[test]
fn test_list_projects_paginates() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    for _ in 0..3 {
        let recipient = Address::generate(&e);
        register_basic(&e, &client, &creator, &recipient);
    }

    let page1 = client.list_projects(&0, &2);
    assert_eq!(page1.len(), 2);
    assert_eq!(page1.get(0).unwrap().id, 0);
    assert_eq!(page1.get(1).unwrap().id, 1);

    let page2 = client.list_projects(&2, &10);
    assert_eq!(page2.len(), 1);
    assert_eq!(page2.get(0).unwrap().id, 2);

    // Start past the end is an empty list, not an error.
    assert_eq!(client.list_projects(&99, &10).len(), 0);
}

#[test]
fn test_register_project_invalid_name() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);

    assert_eq!(
        client.try_register_project(&creator, &e.new_string(""), &e.new_string("desc"), &e.new_string("ipfs://x"), &recipient),
        Err(Ok(Error::InvalidName))
    );
    let long = "a".repeat(MAX_NAME_LEN as usize + 1);
    assert_eq!(
        client.try_register_project(&creator, &long, &e.new_string("desc"), &e.new_string("ipfs://x"), &recipient),
        Err(Ok(Error::InvalidName))
    );
    assert_eq!(client.project_count(), 0);
}

#[test]
fn test_register_project_invalid_description_and_uri() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);

    let long_desc = "d".repeat(MAX_DESCRIPTION_LEN as usize + 1);
    assert_eq!(
        client.try_register_project(&creator, &e.new_string("Name"), &long_desc, &e.new_string("ipfs://x"), &recipient),
        Err(Ok(Error::InvalidDescription))
    );
    let long_uri = "u".repeat(MAX_METADATA_URI_LEN as usize + 1);
    assert_eq!(
        client.try_register_project(&creator, &e.new_string("Name"), &e.new_string("desc"), &long_uri, &recipient),
        Err(Ok(Error::InvalidMetadataUri))
    );
}

#[test]
fn test_register_project_requires_auth() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    // Disable auth mocking: an unsigned registration must fail.
    e.set_auths(&[]);
    assert!(client
        .try_register_project(&creator, &e.new_string("Name"), &e.new_string("desc"), &e.new_string("ipfs://x"), &recipient)
        .is_err());
    assert_eq!(client.project_count(), 0);
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

#[test]
fn test_update_project_by_creator() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    client.update_project(
        &creator,
        &id,
        &e.new_string("Soroban SDK (renamed)"),
        &e.new_string("New description"),
        &e.new_string("ipfs://QmNew"),
    );
    let details = client.project_details(&id);
    assert_eq!(details.name, String::from_str(&e, "Soroban SDK (renamed)"));
    assert_eq!(details.description, String::from_str(&e, "New description"));
    assert_eq!(details.metadata_uri, String::from_str(&e, "ipfs://QmNew"));
    // Unrelated fields are untouched.
    assert_eq!(details.recipient, recipient);
}

#[test]
fn test_update_project_by_stranger_rejected() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    let stranger = Address::generate(&e);
    assert_eq!(
        client.try_update_project(&stranger, &id, &e.new_string("Hijacked"), &e.new_string("desc"), &e.new_string("ipfs://x")),
        Err(Ok(Error::Unauthorized))
    );
    // Name unchanged.
    let details = client.project_details(&id);
    assert_eq!(details.name, String::from_str(&e, "Soroban SDK"));
}

#[test]
fn test_update_project_requires_auth() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    e.set_auths(&[]);
    assert!(client
        .try_update_project(&creator, &id, &e.new_string("X"), &e.new_string("desc"), &e.new_string("ipfs://x"))
        .is_err());
}

#[test]
fn test_set_project_active() {
    let e = Env::default();
    let (creator, _, _) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    client.set_project_active(&creator, &id, &false);
    assert_eq!(client.project_details(&id).active, false);
    client.set_project_active(&creator, &id, &true);
    assert_eq!(client.project_details(&id).active, true);

    // Only the creator can change status.
    let stranger = Address::generate(&e);
    assert_eq!(
        client.try_set_project_active(&stranger, &id, &false),
        Err(Ok(Error::Unauthorized))
    );
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

#[test]
fn test_support_transfers_and_records() {
    let e = Env::default();
    let (creator, supporter, token) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    let supporter_before = balance(&e, &token, &supporter);
    let recipient_before = balance(&e, &token, &recipient);

    e.ledger().set_timestamp(2_000);
    client.support_project(&id, &supporter, &token, &1_000);
    e.ledger().set_timestamp(2_100);
    client.support_project(&id, &supporter, &token, &500);

    // Tokens moved supporter -> recipient directly; the registry held nothing.
    assert_eq!(balance(&e, &token, &supporter), supporter_before - 1_500);
    assert_eq!(balance(&e, &token, &recipient), recipient_before + 1_500);
    assert_eq!(balance(&e, &token, &client.address), 0);
    assert_eq!(client.project_details(&id).total_supported, 1_500);

    let history = client.support_history(&id);
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().amount, 1_000);
    assert_eq!(history.get(0).unwrap().supporter, supporter);
    assert_eq!(history.get(0).unwrap().token, token);
    assert_eq!(history.get(0).unwrap().timestamp, 2_000);
    assert_eq!(history.get(1).unwrap().amount, 500);
    assert_eq!(history.get(1).unwrap().timestamp, 2_100);
}

#[test]
fn test_support_zero_amount_rejected() {
    let e = Env::default();
    let (creator, supporter, token) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    assert_eq!(
        client.try_support_project(&id, &supporter, &token, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_support_project(&id, &supporter, &token, &-1),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn test_support_archived_project_rejected() {
    let e = Env::default();
    let (creator, supporter, token) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    client.set_project_active(&creator, &id, &false);
    assert_eq!(
        client.try_support_project(&id, &supporter, &token, &100),
        Err(Ok(Error::ProjectInactive))
    );
    assert_eq!(client.project_details(&id).total_supported, 0);
}

#[test]
fn test_support_requires_auth() {
    let e = Env::default();
    let (creator, supporter, token) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    e.set_auths(&[]);
    assert!(client.try_support_project(&id, &supporter, &token, &100).is_err());
    assert_eq!(client.project_details(&id).total_supported, 0);
}

#[test]
fn test_support_history_capped() {
    let e = Env::default();
    let (creator, supporter, token) = setup(&e);
    let client = register(&e);
    let recipient = Address::generate(&e);
    let id = register_basic(&e, &client, &creator, &recipient);

    // Fill the ledger past the cap.
    for i in 0..(MAX_HISTORY + 5) {
        e.ledger().set_timestamp(1_000 + i as u64);
        client.support_project(&id, &supporter, &token, &1);
    }

    let history = client.support_history(&id);
    assert_eq!(history.len(), MAX_HISTORY);
    // The oldest 5 entries were dropped; the newest is intact.
    assert_eq!(history.get(0).unwrap().timestamp, 1_000 + 5);
    assert_eq!(history.get(MAX_HISTORY - 1).unwrap().timestamp, 1_000 + MAX_HISTORY as u64 + 4);
}

// ---------------------------------------------------------------------------
// Unknown projects
// ---------------------------------------------------------------------------

#[test]
fn test_unknown_project_errors() {
    let e = Env::default();
    let (_, supporter, token) = setup(&e);
    let client = register(&e);

    assert_eq!(
        client.try_project_details(&42),
        Err(Ok(Error::ProjectNotFound))
    );
    assert_eq!(
        client.try_support_project(&42, &supporter, &token, &100),
        Err(Ok(Error::ProjectNotFound))
    );
    assert_eq!(
        client.try_support_history(&42),
        Err(Ok(Error::ProjectNotFound))
    );
    assert_eq!(
        client.try_update_project(&supporter, &42, &e.new_string("X"), &e.new_string("d"), &e.new_string("ipfs://x")),
        Err(Ok(Error::ProjectNotFound))
    );
}
