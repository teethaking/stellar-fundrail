//! # splitter
//!
//! Payment splitting for [FundRail](https://github.com/fundrail).
//!
//! An owner defines a split: a token plus a set of recipients with shares that
//! must sum to exactly `TOTAL_SHARES` (10_000, i.e. 100% in basis points).
//! Anyone can deposit into a split. Deposited funds are held in the contract
//! until `distribute` allocates them to each recipient's claimable balance
//! proportionally to their shares. Each recipient then claims their own
//! balance.
//!
//! ## Security model
//!
//! * Share sums are validated on every mutation; a split can never be created
//!   or updated with shares that do not sum to 10_000.
//! * Recipient lists are validated for duplicates, empty entries, and a
//!   maximum size so storage and gas stay bounded.
//! * `update_split` and `remove_recipient` are only allowed while the split has
//!   no undistributed deposits (`deposited == distributed`), so changing shares
//!   can never retroactively reallocate funds someone already paid in.
//! * `remove_recipient` refuses to remove a recipient who is still owed a
//!   claimable balance.
//! * `claim` zeroes the claimable balance before the token transfer
//!   (checks-effects-interactions), so a balance can never be claimed twice.
//! * Distribution math uses `u128` intermediates; per-recipient floors are
//!   exact and the rounding remainder is assigned deterministically to the
//!   last recipient, so `sum(allocated) == deposited` always holds.
//!
//! This contract is **experimental** and has not been audited.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, token::TokenClient, Address, Env, Vec,
};

mod test;

// ---------------------------------------------------------------------------
// Storage keys and constants
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_AMOUNT: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const SPLIT_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const SPLIT_LIFETIME_THRESHOLD: u32 = SPLIT_BUMP_AMOUNT - DAY_IN_LEDGERS;
const CLAIM_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const CLAIM_LIFETIME_THRESHOLD: u32 = CLAIM_BUMP_AMOUNT - DAY_IN_LEDGERS;

/// Shares are expressed in basis points; a split's shares must sum to this.
pub const TOTAL_SHARES: u32 = 10_000;
/// Upper bound on recipients per split (bounds storage and distribution gas).
pub const MAX_RECIPIENTS: u32 = 32;

#[derive(Clone)]
#[contracttype]
pub struct ClaimKey {
    pub split_id: u32,
    pub recipient: Address,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Next split id to allocate.
    NextId,
    /// Per-split state, keyed by split id.
    Split(u32),
    /// Per-(split, recipient) claimable balance.
    Claimable(ClaimKey),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A recipient and their share of the split, in basis points.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecipientShare {
    pub recipient: Address,
    pub shares: u32,
}

/// On-chain representation of a split.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Split {
    pub id: u32,
    /// Account that owns the split and may update or remove recipients.
    pub owner: Address,
    /// Token contract the split pays out in.
    pub token: Address,
    /// Recipients and their shares (must sum to `TOTAL_SHARES`).
    pub recipients: Vec<RecipientShare>,
    /// Total amount ever deposited into the split.
    pub deposited: i128,
    /// Portion of `deposited` already allocated to claimable balances.
    pub distributed: i128,
    pub created_at: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent(data_format = "single-value")]
pub struct SplitCreated {
    #[topic]
    split_id: u32,
    owner: Address,
    token: Address,
    recipients: Vec<RecipientShare>,
}

#[contractevent(data_format = "single-value")]
pub struct SplitUpdated {
    #[topic]
    split_id: u32,
    recipients: Vec<RecipientShare>,
}

#[contractevent(data_format = "single-value")]
pub struct Deposited {
    #[topic]
    split_id: u32,
    depositor: Address,
    amount: i128,
    deposited_total: i128,
}

#[contractevent(data_format = "single-value")]
pub struct Distributed {
    #[topic]
    split_id: u32,
    amount: i128,
}

#[contractevent(data_format = "single-value")]
pub struct Claimed {
    #[topic]
    split_id: u32,
    recipient: Address,
    amount: i128,
}

#[contractevent(data_format = "single-value")]
pub struct RecipientRemoved {
    #[topic]
    split_id: u32,
    recipient: Address,
    remaining: Vec<RecipientShare>,
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
    /// Recipient list is empty, too large, contains zero shares, or shares do
    /// not sum to `TOTAL_SHARES`.
    InvalidRecipients = 2,
    /// The recipient list contains the same address twice.
    DuplicateRecipient = 3,
    /// No split exists with the given id.
    SplitNotFound = 4,
    /// The split still holds undistributed deposits; settle it first.
    SplitActive = 5,
    /// The recipient still has an outstanding claimable balance.
    OutstandingClaim = 6,
    /// The address is not a recipient of this split.
    RecipientNotFound = 7,
    /// `distribute` called with nothing to distribute.
    NothingToDistribute = 8,
    /// `claim` called with no claimable balance.
    NothingToClaim = 9,
    /// Arithmetic overflow while updating balances.
    ArithmeticOverflow = 10,
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

fn read_split(env: &Env, id: u32) -> Result<Split, Error> {
    let key = DataKey::Split(id);
    env.storage()
        .persistent()
        .get::<DataKey, Split>(&key)
        .ok_or(Error::SplitNotFound)
}

fn write_split(env: &Env, split: &Split) {
    let key = DataKey::Split(split.id);
    env.storage().persistent().set(&key, split);
    env.storage()
        .persistent()
        .extend_ttl(&key, SPLIT_LIFETIME_THRESHOLD, SPLIT_BUMP_AMOUNT);
}

fn read_claimable(env: &Env, split_id: u32, recipient: &Address) -> i128 {
    let key = DataKey::Claimable(ClaimKey {
        split_id,
        recipient: recipient.clone(),
    });
    env.storage().persistent().get::<DataKey, i128>(&key).unwrap_or(0)
}

fn add_claimable(env: &Env, split_id: u32, recipient: &Address, amount: i128) -> Result<(), Error> {
    let key = DataKey::Claimable(ClaimKey {
        split_id,
        recipient: recipient.clone(),
    });
    let current = read_claimable(env, split_id, recipient);
    let next = current.checked_add(amount).ok_or(Error::ArithmeticOverflow)?;
    env.storage().persistent().set(&key, &next);
    env.storage()
        .persistent()
        .extend_ttl(&key, CLAIM_LIFETIME_THRESHOLD, CLAIM_BUMP_AMOUNT);
    Ok(())
}

/// Validates a recipient list:
/// * 1..=MAX_RECIPIENTS entries
/// * every share positive
/// * no duplicate addresses
/// * shares sum to exactly `TOTAL_SHARES`
fn validate_recipients(recipients: &Vec<RecipientShare>) -> Result<(), Error> {
    let n = recipients.len();
    if n == 0 || n > MAX_RECIPIENTS {
        return Err(Error::InvalidRecipients);
    }
    let mut total: u64 = 0;
    for i in 0..n {
        let rs = recipients.get(i).unwrap();
        if rs.shares == 0 {
            return Err(Error::InvalidRecipients);
        }
        for j in (i + 1)..n {
            if recipients.get(j).unwrap().recipient == rs.recipient {
                return Err(Error::DuplicateRecipient);
            }
        }
        total += rs.shares as u64;
    }
    if total != TOTAL_SHARES as u64 {
        return Err(Error::InvalidRecipients);
    }
    Ok(())
}

/// Re-scales an existing recipient list so the shares sum to `TOTAL_SHARES`
/// while preserving relative weights. Each share is floored; the rounding
/// remainder is assigned to the first recipient so the sum is exact.
fn normalize_shares(recipients: &mut Vec<RecipientShare>) -> Result<(), Error> {
    let n = recipients.len();
    if n == 0 {
        return Err(Error::InvalidRecipients);
    }
    let mut total: u64 = 0;
    for i in 0..n {
        total += recipients.get(i).unwrap().shares as u64;
    }
    if total == 0 {
        return Err(Error::InvalidRecipients);
    }
    let mut assigned: u64 = 0;
    for i in 0..n {
        let rs = recipients.get(i).unwrap();
        let scaled = (rs.shares as u64 * TOTAL_SHARES as u64) / total;
        assigned += scaled;
        let mut updated = rs;
        updated.shares = scaled as u32;
        recipients.set(i, updated);
    }
    let remainder = TOTAL_SHARES as u64 - assigned;
    if remainder > 0 {
        let first = recipients.get(0).unwrap();
        let mut updated = first;
        updated.shares = (updated.shares as u64 + remainder) as u32;
        recipients.set(0, updated);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct Splitter;

#[contractimpl]
impl Splitter {
    /// Creates a new split.
    ///
    /// # Arguments
    /// * `owner` - Account that owns and controls the split
    /// * `token` - Token contract the split pays out in
    /// * `recipients` - Recipients with shares summing to exactly 10_000
    ///
    /// # Errors
    /// * `InvalidRecipients` - empty list, > `MAX_RECIPIENTS` entries, zero
    ///   shares, or shares do not sum to 10_000
    /// * `DuplicateRecipient` - the same address appears twice
    pub fn create_split(
        env: Env,
        owner: Address,
        token: Address,
        recipients: Vec<RecipientShare>,
    ) -> Result<u32, Error> {
        owner.require_auth();
        bump_instance(&env);
        validate_recipients(&recipients)?;

        let id = next_id(&env);
        let split = Split {
            id,
            owner: owner.clone(),
            token: token.clone(),
            recipients: recipients.clone(),
            deposited: 0,
            distributed: 0,
            created_at: env.ledger().timestamp(),
        };
        write_split(&env, &split);
        env.storage()
            .persistent()
            .set(&DataKey::NextId, &id.checked_add(1).ok_or(Error::ArithmeticOverflow)?);

        SplitCreated {
            split_id: id,
            owner,
            token,
            recipients,
        }
        .publish(&env);
        Ok(id)
    }

    /// Updates the recipients of a split.
    ///
    /// Only the split's owner may update it, and only while no deposited
    /// funds are waiting to be allocated (`deposited == distributed`). This
    /// guarantees shares can never be changed retroactively on money already
    /// paid in.
    pub fn update_split(
        env: Env,
        split_id: u32,
        recipients: Vec<RecipientShare>,
    ) -> Result<(), Error> {
        let mut split = read_split(&env, split_id)?;
        split.owner.require_auth();
        bump_instance(&env);
        if split.deposited != split.distributed {
            return Err(Error::SplitActive);
        }
        validate_recipients(&recipients)?;
        split.recipients = recipients.clone();
        write_split(&env, &split);
        SplitUpdated { split_id, recipients }.publish(&env);
        Ok(())
    }

    /// Deposits funds into a split. Anyone may deposit.
    ///
    /// # Arguments
    /// * `split_id` - Id of the split to fund
    /// * `depositor` - Account providing the funds
    /// * `amount` - Amount to deposit (token base units)
    ///
    /// # Security
    /// The deposit is pulled into the contract with the token contract's
    /// `transfer`, which authenticates `depositor`.
    pub fn deposit(env: Env, split_id: u32, depositor: Address, amount: i128) -> Result<(), Error> {
        let mut split = read_split(&env, split_id)?;
        depositor.require_auth();
        bump_instance(&env);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let contract = env.current_contract_address();
        TokenClient::new(&env, &split.token).transfer(&depositor, &contract, &amount);
        split.deposited = split
            .deposited
            .checked_add(amount)
            .ok_or(Error::ArithmeticOverflow)?;
        let deposited_total = split.deposited;
        write_split(&env, &split);
        Deposited {
            split_id,
            depositor,
            amount,
            deposited_total,
        }
        .publish(&env);
        Ok(())
    }

    /// Allocates all undistributed deposits to each recipient's claimable
    /// balance, proportionally to their shares. Anyone may call this; it can
    /// only move funds toward recipients, never away from them.
    ///
    /// # Errors
    /// * `NothingToDistribute` - there are no undistributed deposits
    pub fn distribute(env: Env, split_id: u32) -> Result<(), Error> {
        let mut split = read_split(&env, split_id)?;
        bump_instance(&env);
        // Invariant: deposited >= distributed, maintained by every mutation.
        let pending = split.deposited - split.distributed;
        if pending == 0 {
            return Err(Error::NothingToDistribute);
        }
        let n = split.recipients.len();
        let mut assigned: i128 = 0;
        for i in 0..n {
            let rs = split.recipients.get(i).unwrap();
            // The last recipient absorbs the rounding remainder so the
            // allocation is exact: sum(allocated) == pending.
            let amount = if i == n - 1 {
                pending - assigned
            } else {
                ((pending as u128 * rs.shares as u128) / TOTAL_SHARES as u128) as i128
            };
            add_claimable(&env, split_id, &rs.recipient, amount)?;
            assigned += amount;
        }
        split.distributed = split.deposited;
        write_split(&env, &split);
        Distributed {
            split_id,
            amount: pending,
        }
        .publish(&env);
        Ok(())
    }

    /// Claims a recipient's full claimable balance from a split.
    ///
    /// # Errors
    /// * `NothingToClaim` - the recipient has no claimable balance
    ///
    /// # Security
    /// Only the recipient themselves may claim. The balance is zeroed in
    /// storage *before* the token transfer, making double-claiming impossible
    /// even if the token contract were to call back into this contract.
    pub fn claim(env: Env, split_id: u32, recipient: Address) -> Result<(), Error> {
        recipient.require_auth();
        bump_instance(&env);
        let split = read_split(&env, split_id)?;
        let claimable = read_claimable(&env, split_id, &recipient);
        if claimable <= 0 {
            return Err(Error::NothingToClaim);
        }
        let key = DataKey::Claimable(ClaimKey {
            split_id,
            recipient: recipient.clone(),
        });
        env.storage().persistent().remove(&key);
        let contract = env.current_contract_address();
        TokenClient::new(&env, &split.token).transfer(&contract, &recipient, &claimable);
        Claimed {
            split_id,
            recipient,
            amount: claimable,
        }
        .publish(&env);
        Ok(())
    }

    /// Removes a recipient from a split, re-scaling the remaining shares so
    /// they still sum to 10_000 (relative weights are preserved).
    ///
    /// Only the owner may call this, and only while the split has no
    /// undistributed deposits and the removed recipient has no outstanding
    /// claimable balance.
    pub fn remove_recipient(
        env: Env,
        split_id: u32,
        recipient: Address,
    ) -> Result<(), Error> {
        let mut split = read_split(&env, split_id)?;
        split.owner.require_auth();
        bump_instance(&env);
        if split.deposited != split.distributed {
            return Err(Error::SplitActive);
        }
        if read_claimable(&env, split_id, &recipient) > 0 {
            return Err(Error::OutstandingClaim);
        }
        let mut remaining: Vec<RecipientShare> = Vec::new(&env);
        let mut found = false;
        for i in 0..split.recipients.len() {
            let rs = split.recipients.get(i).unwrap();
            if rs.recipient == recipient {
                found = true;
            } else {
                remaining.push_back(rs);
            }
        }
        if !found {
            return Err(Error::RecipientNotFound);
        }
        normalize_shares(&mut remaining)?;
        split.recipients = remaining.clone();
        write_split(&env, &split);
        RecipientRemoved {
            split_id,
            recipient,
            remaining,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the full on-chain state of a split.
    pub fn split_details(env: Env, split_id: u32) -> Result<Split, Error> {
        bump_instance(&env);
        read_split(&env, split_id)
    }

    /// Returns a recipient's claimable balance in a split.
    pub fn claimable_balance(env: Env, split_id: u32, recipient: Address) -> Result<i128, Error> {
        bump_instance(&env);
        read_split(&env, split_id)?;
        Ok(read_claimable(&env, split_id, &recipient))
    }

    /// Returns the number of splits created so far (ids are 0-indexed).
    pub fn split_count(env: Env) -> u32 {
        bump_instance(&env);
        next_id(&env)
    }
}
