//! # funding_stream
//!
//! Recurring funding streams for [FundRail](https://github.com/fundrail).
//!
//! A sender escrows `total_amount` of a token and defines a time window
//! `[start_time, end_time)`. The funds accrue to the recipient continuously at
//! a fixed per-second `rate`, and the recipient can withdraw the accrued
//! (claimable) balance at any time. The sender can pause, resume, or cancel
//! the stream; cancellation pays the recipient what they have earned and
//! refunds the unearned remainder to the sender.
//!
//! ## Security model
//!
//! * Every state-changing function authenticates the calling principal with
//!   `Address::require_auth` before touching state.
//! * Withdrawals are capped at the claimable balance; the claimable balance is
//!   derived from immutable stream parameters, so it cannot be manipulated.
//! * All token movement goes through the Stellar token interface (the
//!   `transfer` host function), which itself authenticates the sender.
//! * Arithmetic uses `checked_*` operations and `u128` intermediates; the
//!   workspace release profile also keeps `overflow-checks` enabled.
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
const STREAM_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const STREAM_LIFETIME_THRESHOLD: u32 = STREAM_BUMP_AMOUNT - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Next stream id to allocate.
    NextId,
    /// Per-stream state, keyed by stream id.
    Stream(u32),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Lifecycle status of a stream.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StreamStatus {
    /// Stream is live and accruing to the recipient.
    Active,
    /// Stream is paused; no further accrual until resumed.
    Paused,
    /// Stream was cancelled; the escrow has been settled.
    Cancelled,
}

/// On-chain representation of a funding stream.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub id: u32,
    /// Account that escrowed the funds and controls the stream.
    pub sender: Address,
    /// Account that receives the streamed funds.
    pub recipient: Address,
    /// Token contract the stream pays out in.
    pub token: Address,
    /// Unix timestamp (seconds) when accrual begins.
    pub start_time: u64,
    /// Unix timestamp (seconds) when accrual ends.
    pub end_time: u64,
    /// Token base units accrued per second.
    pub rate: i128,
    /// Total amount escrowed at creation.
    pub total_amount: i128,
    /// Amount the recipient has withdrawn so far.
    pub withdrawn: i128,
    pub status: StreamStatus,
    /// `Some(t)` while paused; `t` is the pause timestamp.
    pub paused_at: Option<u64>,
    /// Total seconds the stream has been paused (excluding the current pause).
    pub paused_seconds: u64,
    /// Ledger timestamp at creation.
    pub created_at: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent(data_format = "single-value")]
pub struct StreamCreated {
    #[topic]
    stream_id: u32,
    sender: Address,
    recipient: Address,
    token: Address,
    total_amount: i128,
    rate: i128,
    start_time: u64,
    end_time: u64,
}

#[contractevent(data_format = "single-value")]
pub struct StreamPaused {
    #[topic]
    stream_id: u32,
    at: u64,
}

#[contractevent(data_format = "single-value")]
pub struct StreamResumed {
    #[topic]
    stream_id: u32,
    at: u64,
}

#[contractevent(data_format = "single-value")]
pub struct StreamCancelled {
    #[topic]
    stream_id: u32,
    earned: i128,
    refunded: i128,
}

#[contractevent(data_format = "single-value")]
pub struct Withdrawal {
    #[topic]
    stream_id: u32,
    recipient: Address,
    amount: i128,
    withdrawn_total: i128,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// `total_amount` must be positive.
    InvalidAmount = 1,
    /// `start_time >= end_time`, `end_time <= now`, or `start_time < now`.
    InvalidTimestamps = 2,
    /// No stream exists with the given id.
    StreamNotFound = 3,
    /// The stream is not in the state required by the operation.
    InvalidStatus = 4,
    /// Requested withdrawal exceeds the claimable balance.
    OverWithdrawal = 5,
    /// Arithmetic overflow while computing balances.
    ArithmeticOverflow = 6,
    /// A stream must have distinct sender and recipient.
    SelfStream = 7,
    /// The amount is too small for the duration (per-second rate would be 0).
    DurationTooLong = 8,
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

fn read_stream(env: &Env, id: u32) -> Result<Stream, Error> {
    let key = DataKey::Stream(id);
    env.storage()
        .persistent()
        .get::<DataKey, Stream>(&key)
        .ok_or(Error::StreamNotFound)
}

fn write_stream(env: &Env, stream: &Stream) {
    let key = DataKey::Stream(stream.id);
    env.storage().persistent().set(&key, stream);
    env.storage()
        .persistent()
        .extend_ttl(&key, STREAM_LIFETIME_THRESHOLD, STREAM_BUMP_AMOUNT);
}

/// Number of seconds the stream has been accruing up to `now`.
fn active_seconds(stream: &Stream, now: u64) -> u64 {
    if now <= stream.start_time {
        return 0;
    }
    let elapsed = now.min(stream.end_time) - stream.start_time;
    let paused = stream.paused_seconds
        + stream
            .paused_at
            .map(|at| now.saturating_sub(at))
            .unwrap_or(0);
    elapsed.saturating_sub(paused)
}

/// Amount the recipient can currently withdraw.
///
/// `rate * active_seconds <= rate * (end - start) <= total_amount` because the
/// rate is derived from the validated stream parameters, so the `u128`
/// intermediate can never overflow `i128` for streams created through this
/// contract.
fn claimable_amount(stream: &Stream, now: u64) -> Result<i128, Error> {
    // A cancelled stream has a settled escrow; nothing more is claimable.
    if stream.status == StreamStatus::Cancelled {
        return Ok(0);
    }
    let earned = (stream.rate as u128)
        .checked_mul(active_seconds(stream, now) as u128)
        .ok_or(Error::ArithmeticOverflow)?;
    let earned = i128::try_from(earned).map_err(|_| Error::ArithmeticOverflow)?;
    Ok(earned.saturating_sub(stream.withdrawn))
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct FundingStream;

#[contractimpl]
impl FundingStream {
    /// Creates a new recurring funding stream.
    ///
    /// # Arguments
    /// * `sender` - Account providing the funds and controlling the stream
    /// * `recipient` - Account receiving the streamed funds
    /// * `token` - Token contract the stream pays out in
    /// * `total_amount` - Total amount escrowed (token base units)
    /// * `start_time` - Unix timestamp (seconds) when accrual starts
    /// * `end_time` - Unix timestamp (seconds) when accrual ends
    ///
    /// # Errors
    /// * `InvalidAmount` - `total_amount <= 0`
    /// * `SelfStream` - `recipient == sender`
    /// * `InvalidTimestamps` - `start_time < now`, `start_time >= end_time`,
    ///   or `end_time <= now`
    /// * `DurationTooLong` - per-second rate would round down to zero
    ///
    /// # Security
    /// Escrows `total_amount` from `sender` into this contract via the token
    /// contract's `transfer` host function, which authenticates `sender`. The
    /// explicit `sender.require_auth()` ensures the sender authorized this
    /// specific invocation.
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        start_time: u64,
        end_time: u64,
    ) -> Result<u32, Error> {
        sender.require_auth();
        bump_instance(&env);
        let now = env.ledger().timestamp();

        if total_amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if recipient == sender {
            return Err(Error::SelfStream);
        }
        if start_time < now || start_time >= end_time || end_time <= now {
            return Err(Error::InvalidTimestamps);
        }
        let rate = total_amount / (end_time - start_time) as i128;
        if rate < 1 {
            return Err(Error::DurationTooLong);
        }

        let stream = Stream {
            id: next_id(&env),
            sender: sender.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            start_time,
            end_time,
            rate,
            total_amount,
            withdrawn: 0,
            status: StreamStatus::Active,
            paused_at: None,
            paused_seconds: 0,
            created_at: now,
        };

        // Escrow the funds into the contract. The token contract re-checks
        // sender authorization for this transfer.
        let contract = env.current_contract_address();
        TokenClient::new(&env, &token).transfer(&sender, &contract, &total_amount);

        let id = stream.id;
        write_stream(&env, &stream);
        env.storage()
            .persistent()
            .set(&DataKey::NextId, &id.checked_add(1).ok_or(Error::ArithmeticOverflow)?);

        StreamCreated {
            stream_id: id,
            sender,
            recipient,
            token,
            total_amount,
            rate,
            start_time,
            end_time,
        }
        .publish(&env);
        Ok(id)
    }

    /// Pauses a stream so it stops accruing to the recipient.
    ///
    /// Only the stream's sender may pause it, and only while it is `Active`.
    pub fn pause_stream(env: Env, stream_id: u32) -> Result<(), Error> {
        let mut stream = read_stream(&env, stream_id)?;
        stream.sender.require_auth();
        bump_instance(&env);
        if stream.status != StreamStatus::Active {
            return Err(Error::InvalidStatus);
        }
        let now = env.ledger().timestamp();
        if now >= stream.end_time {
            // Nothing left to pause; the stream has run its course.
            return Err(Error::InvalidStatus);
        }
        stream.status = StreamStatus::Paused;
        stream.paused_at = Some(now);
        write_stream(&env, &stream);
        StreamPaused { stream_id, at: now }.publish(&env);
        Ok(())
    }

    /// Resumes a paused stream. Accrual continues from the paused point.
    ///
    /// Only the stream's sender may resume it, and only while it is `Paused`.
    pub fn resume_stream(env: Env, stream_id: u32) -> Result<(), Error> {
        let mut stream = read_stream(&env, stream_id)?;
        stream.sender.require_auth();
        bump_instance(&env);
        if stream.status != StreamStatus::Paused {
            return Err(Error::InvalidStatus);
        }
        let now = env.ledger().timestamp();
        let paused_at = stream.paused_at.ok_or(Error::InvalidStatus)?;
        stream.paused_seconds = stream
            .paused_seconds
            .checked_add(now.saturating_sub(paused_at))
            .ok_or(Error::ArithmeticOverflow)?;
        stream.paused_at = None;
        stream.status = StreamStatus::Active;
        write_stream(&env, &stream);
        StreamResumed { stream_id, at: now }.publish(&env);
        Ok(())
    }

    /// Cancels a stream and settles its escrow.
    ///
    /// Only the stream's sender may cancel it, and only while it is `Active`
    /// or `Paused`. The recipient is paid the amount earned up to
    /// cancellation; the unearned remainder is refunded to the sender. After
    /// cancellation the escrow is empty and nothing further is claimable.
    pub fn cancel_stream(env: Env, stream_id: u32) -> Result<(), Error> {
        let mut stream = read_stream(&env, stream_id)?;
        stream.sender.require_auth();
        bump_instance(&env);
        match stream.status {
            StreamStatus::Active | StreamStatus::Paused => {}
            StreamStatus::Cancelled => return Err(Error::InvalidStatus),
        }
        let now = env.ledger().timestamp();
        let claimable = claimable_amount(&stream, now)?;
        let token = TokenClient::new(&env, &stream.token);
        let contract = env.current_contract_address();

        // Conservation: total_amount == withdrawn + claimable + refund.
        if claimable > 0 {
            token.transfer(&contract, &stream.recipient, &claimable);
        }
        let refund = stream.total_amount - stream.withdrawn - claimable;
        if refund > 0 {
            token.transfer(&contract, &stream.sender, &refund);
        }

        stream.withdrawn = stream.total_amount;
        stream.status = StreamStatus::Cancelled;
        stream.paused_at = None;
        write_stream(&env, &stream);
        StreamCancelled {
            stream_id,
            earned: claimable,
            refunded: refund,
        }
        .publish(&env);
        Ok(())
    }

    /// Withdraws up to the claimable balance for the recipient.
    ///
    /// # Arguments
    /// * `stream_id` - Id of the stream to withdraw from
    /// * `amount` - Amount to withdraw (token base units)
    ///
    /// # Errors
    /// * `InvalidAmount` - `amount <= 0`
    /// * `OverWithdrawal` - `amount` exceeds the claimable balance
    /// * `InvalidStatus` - stream has been cancelled
    ///
    /// # Security
    /// Only the recipient may withdraw. The claimable balance is computed
    /// from immutable stream parameters and the ledger timestamp, so an
    /// attacker cannot inflate it or double-withdraw: `withdrawn` is
    /// incremented before the token transfer, and `amount` is capped by
    /// `claimable_amount`.
    pub fn withdraw(env: Env, stream_id: u32, amount: i128) -> Result<(), Error> {
        let mut stream = read_stream(&env, stream_id)?;
        stream.recipient.require_auth();
        bump_instance(&env);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if stream.status == StreamStatus::Cancelled {
            return Err(Error::InvalidStatus);
        }
        let now = env.ledger().timestamp();
        let claimable = claimable_amount(&stream, now)?;
        if amount > claimable {
            return Err(Error::OverWithdrawal);
        }
        stream.withdrawn = stream
            .withdrawn
            .checked_add(amount)
            .ok_or(Error::ArithmeticOverflow)?;

        let token = TokenClient::new(&env, &stream.token);
        let contract = env.current_contract_address();
        token.transfer(&contract, &stream.recipient, &amount);

        let withdrawn_total = stream.withdrawn;
        write_stream(&env, &stream);
        Withdrawal {
            stream_id,
            recipient: stream.recipient.clone(),
            amount,
            withdrawn_total,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the amount the recipient can currently withdraw.
    pub fn claimable_balance(env: Env, stream_id: u32) -> Result<i128, Error> {
        bump_instance(&env);
        let stream = read_stream(&env, stream_id)?;
        claimable_amount(&stream, env.ledger().timestamp())
    }

    /// Returns the full on-chain state of a stream.
    pub fn stream_details(env: Env, stream_id: u32) -> Result<Stream, Error> {
        bump_instance(&env);
        read_stream(&env, stream_id)
    }

    /// Returns the number of streams created so far (ids are 0-indexed).
    pub fn stream_count(env: Env) -> u32 {
        bump_instance(&env);
        next_id(&env)
    }
}
