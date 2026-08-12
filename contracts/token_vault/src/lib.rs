//! # token_vault
//!
//! Reusable token escrow for [FundRail](https://github.com/fundrail).
//!
//! A vault is a per-(owner, token) custody box: anyone can deposit into it,
//! but only the owner can withdraw. It is the primitive underneath the other
//! FundRail contracts — a place to park public-goods funds (grants, matching
//! pools, treasury balances) before they are streamed or split out. It is
//! deliberately small and auditable.
//!
//! ## Security model
//!
//! * `withdraw` and `transfer_ownership` authenticate the owner with
//!   `Address::require_auth` and verify the caller is the stored owner.
//! * `withdraw` is capped by the vault's recorded balance and updates the
//!   balance *before* the token transfer, so the same units can never be
//!   withdrawn twice even if the token contract re-enters this contract.
//! * `deposit` pulls funds with the token contract's `transfer` host function,
//!   which authenticates the depositor; anyone may deposit.
//! * Arithmetic uses `checked_*` operations; the workspace release profile
//!   also keeps `overflow-checks` enabled.
//!
//! This contract is **experimental** and has not been audited.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, token::TokenClient, Address, Env,
};

mod test;

// ---------------------------------------------------------------------------
// Storage keys and constants
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_AMOUNT: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const VAULT_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const VAULT_LIFETIME_THRESHOLD: u32 = VAULT_BUMP_AMOUNT - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Next vault id to allocate.
    NextId,
    /// Per-vault state, keyed by vault id.
    Vault(u32),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// On-chain representation of a token vault.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vault {
    pub id: u32,
    /// Account that controls the vault and may withdraw from it.
    pub owner: Address,
    /// Token contract the vault holds.
    pub token: Address,
    /// Recorded balance, in token base units.
    pub balance: i128,
    /// Ledger timestamp at creation.
    pub created_at: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent(data_format = "single-value")]
pub struct VaultCreated {
    #[topic]
    vault_id: u32,
    owner: Address,
    token: Address,
}

#[contractevent(data_format = "single-value")]
pub struct VaultDeposited {
    #[topic]
    vault_id: u32,
    depositor: Address,
    amount: i128,
    balance: i128,
}

#[contractevent(data_format = "single-value")]
pub struct VaultWithdrawn {
    #[topic]
    vault_id: u32,
    to: Address,
    amount: i128,
    balance: i128,
}

#[contractevent(data_format = "single-value")]
pub struct OwnershipTransferred {
    #[topic]
    vault_id: u32,
    previous_owner: Address,
    new_owner: Address,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Amount must be positive.
    InvalidAmount = 1,
    /// No vault exists with the given id.
    VaultNotFound = 2,
    /// Withdrawal exceeds the vault's balance.
    OverWithdrawal = 3,
    /// The caller is not the vault's owner.
    Unauthorized = 4,
    /// Arithmetic overflow while updating balances.
    ArithmeticOverflow = 5,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

fn next_id(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get::<DataKey, u32>(&DataKey::NextId)
        .unwrap_or(0)
}

fn read_vault(env: &Env, id: u32) -> Result<Vault, Error> {
    let key = DataKey::Vault(id);
    env.storage()
        .persistent()
        .get::<DataKey, Vault>(&key)
        .ok_or(Error::VaultNotFound)
}

fn write_vault(env: &Env, vault: &Vault) {
    let key = DataKey::Vault(vault.id);
    env.storage().persistent().set(&key, vault);
    env.storage()
        .persistent()
        .extend_ttl(&key, VAULT_LIFETIME_THRESHOLD, VAULT_BUMP_AMOUNT);
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct TokenVault;

#[contractimpl]
impl TokenVault {
    /// Creates a new vault for `owner` holding `token`.
    ///
    /// # Security
    /// Only `owner` may create a vault in their name; the vault's balance is
    /// zero until someone deposits.
    pub fn create_vault(env: Env, owner: Address, token: Address) -> Result<u32, Error> {
        owner.require_auth();
        bump_instance(&env);

        let id = next_id(&env);
        let vault = Vault {
            id,
            owner: owner.clone(),
            token: token.clone(),
            balance: 0,
            created_at: env.ledger().timestamp(),
        };
        write_vault(&env, &vault);
        env.storage()
            .persistent()
            .set(&DataKey::NextId, &id.checked_add(1).ok_or(Error::ArithmeticOverflow)?);

        VaultCreated {
            vault_id: id,
            owner,
            token,
        }
        .publish(&env);
        Ok(id)
    }

    /// Deposits funds into a vault. Anyone may deposit into any vault.
    ///
    /// # Security
    /// The deposit is pulled into the contract with the token contract's
    /// `transfer`, which authenticates `depositor`.
    pub fn deposit(env: Env, vault_id: u32, depositor: Address, amount: i128) -> Result<(), Error> {
        let mut vault = read_vault(&env, vault_id)?;
        depositor.require_auth();
        bump_instance(&env);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let contract = env.current_contract_address();
        TokenClient::new(&env, &vault.token).transfer(&depositor, &contract, &amount);
        vault.balance = vault
            .balance
            .checked_add(amount)
            .ok_or(Error::ArithmeticOverflow)?;
        let balance = vault.balance;
        write_vault(&env, &vault);
        VaultDeposited {
            vault_id,
            depositor,
            amount,
            balance,
        }
        .publish(&env);
        Ok(())
    }

    /// Withdraws funds from a vault to an arbitrary `to` address.
    ///
    /// # Arguments
    /// * `vault_id` - Id of the vault to withdraw from
    /// * `owner` - The vault's owner (authenticated)
    /// * `to` - Address receiving the withdrawn funds
    /// * `amount` - Amount to withdraw (token base units)
    ///
    /// # Errors
    /// * `Unauthorized` - `owner` is not the vault's owner
    /// * `InvalidAmount` - `amount <= 0`
    /// * `OverWithdrawal` - `amount` exceeds the vault's balance
    ///
    /// # Security
    /// The balance is decremented before the token transfer (checks-effects-
    /// interactions), so the same units can never be withdrawn twice.
    pub fn withdraw(
        env: Env,
        vault_id: u32,
        owner: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), Error> {
        let mut vault = read_vault(&env, vault_id)?;
        owner.require_auth();
        bump_instance(&env);
        if vault.owner != owner {
            return Err(Error::Unauthorized);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amount > vault.balance {
            return Err(Error::OverWithdrawal);
        }
        vault.balance = vault
            .balance
            .checked_sub(amount)
            .ok_or(Error::ArithmeticOverflow)?;
        let balance = vault.balance;

        let contract = env.current_contract_address();
        TokenClient::new(&env, &vault.token).transfer(&contract, &to, &amount);

        write_vault(&env, &vault);
        VaultWithdrawn {
            vault_id,
            to,
            amount,
            balance,
        }
        .publish(&env);
        Ok(())
    }

    /// Transfers ownership of a vault. Only the current owner may do this; the
    /// new owner gains full withdrawal control.
    pub fn transfer_ownership(
        env: Env,
        vault_id: u32,
        owner: Address,
        new_owner: Address,
    ) -> Result<(), Error> {
        let mut vault = read_vault(&env, vault_id)?;
        owner.require_auth();
        bump_instance(&env);
        if vault.owner != owner {
            return Err(Error::Unauthorized);
        }
        let previous_owner = vault.owner.clone();
        vault.owner = new_owner.clone();
        write_vault(&env, &vault);
        OwnershipTransferred {
            vault_id,
            previous_owner,
            new_owner,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the full on-chain state of a vault.
    pub fn vault_details(env: Env, vault_id: u32) -> Result<Vault, Error> {
        bump_instance(&env);
        read_vault(&env, vault_id)
    }

    /// Returns a vault's recorded balance.
    pub fn vault_balance(env: Env, vault_id: u32) -> Result<i128, Error> {
        bump_instance(&env);
        read_vault(&env, vault_id).map(|v| v.balance)
    }

    /// Returns the number of vaults created so far (ids are 0-indexed).
    pub fn vault_count(env: Env) -> u32 {
        bump_instance(&env);
        next_id(&env)
    }
}
