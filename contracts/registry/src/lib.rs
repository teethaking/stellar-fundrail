//! # registry
//!
//! Public project registry for [FundRail](https://github.com/fundrail).
//!
//! Anyone can register a project (name, short description, and a metadata URI
//! that points at the full off-chain profile: readme, GitHub, website, assets).
//! Each project names a Stellar wallet that receives funding. The registry is
//! a **directory, not a treasury**: `support_project` transfers tokens directly
//! from the supporter to the project's wallet and records the donation in the
//! project's on-chain support history.
//!
//! ## Data model
//!
//! Only small, bounded metadata is stored on-chain. Rich content (long
//! descriptions, images, social links) belongs behind the `metadata_uri`, which
//! keeps on-chain storage predictable and cheap:
//!
//! * `name` <= 64 bytes
//! * `description` <= 512 bytes
//! * `metadata_uri` <= 256 bytes
//! * support history is capped at `MAX_HISTORY` entries (oldest dropped)
//!
//! ## Security model
//!
//! * Every state-changing function authenticates the calling principal with
//!   `Address::require_auth` before touching state.
//! * Only the project's creator can update metadata or change status; the
//!   creator's address is checked against the stored record after auth.
//! * `support_project` pulls funds with the token contract's `transfer` host
//!   function, which authenticates the supporter. The registry never holds
//!   custody of funds, so it cannot be drained.
//! * Archived projects cannot receive support.
//! * Arithmetic uses `checked_*` operations; the workspace release profile also
//!   keeps `overflow-checks` enabled.
//!
//! This contract is **experimental** and has not been audited.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, token::TokenClient, Address, Env, String,
    Vec,
};

mod test;

// ---------------------------------------------------------------------------
// Storage keys and constants
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_AMOUNT: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const PROJECT_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const PROJECT_LIFETIME_THRESHOLD: u32 = PROJECT_BUMP_AMOUNT - DAY_IN_LEDGERS;

/// Upper bound on a project name (bytes).
pub const MAX_NAME_LEN: u32 = 64;
/// Upper bound on the on-chain description (bytes).
pub const MAX_DESCRIPTION_LEN: u32 = 512;
/// Upper bound on the metadata URI (bytes). Everything larger lives
/// off-chain behind this pointer.
pub const MAX_METADATA_URI_LEN: u32 = 256;
/// Maximum support-history entries kept per project (oldest dropped beyond
/// this, keeping storage bounded).
pub const MAX_HISTORY: u32 = 200;
/// Upper bound on `list_projects` page size.
pub const MAX_LIST_LIMIT: u32 = 100;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Next project id to allocate.
    NextId,
    /// Per-project state, keyed by project id.
    Project(u32),
    /// Project ids owned by a creator (enables `my_projects`).
    CreatorProjects(Address),
    /// On-chain support ledger for a project (capped at `MAX_HISTORY`).
    SupportHistory(u32),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// On-chain representation of a registered project.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Project {
    pub id: u32,
    /// Address that registered the project and controls its metadata.
    pub creator: Address,
    /// Short public name (<= `MAX_NAME_LEN` bytes).
    pub name: String,
    /// Short description (<= `MAX_DESCRIPTION_LEN` bytes).
    pub description: String,
    /// Off-chain pointer to the full project profile.
    pub metadata_uri: String,
    /// Wallet that receives funding for the project.
    pub recipient: Address,
    /// Whether the project can receive support.
    pub active: bool,
    /// Aggregate support received, in base units. Summed across tokens, so it
    /// is an indicator, not a wallet balance — the per-entry `token` field in
    /// `SupportEntry` is authoritative for accounting.
    pub total_supported: i128,
    /// Ledger timestamp at registration.
    pub created_at: u64,
}

/// A single recorded donation to a project.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SupportEntry {
    pub supporter: Address,
    /// Token contract the donation was paid in.
    pub token: Address,
    /// Amount donated, in base units.
    pub amount: i128,
    /// Ledger timestamp of the donation.
    pub timestamp: u64,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent(data_format = "single-value")]
pub struct ProjectRegistered {
    #[topic]
    project_id: u32,
    creator: Address,
    name: String,
    recipient: Address,
    metadata_uri: String,
}

#[contractevent(data_format = "single-value")]
pub struct ProjectUpdated {
    #[topic]
    project_id: u32,
    name: String,
    metadata_uri: String,
}

#[contractevent(data_format = "single-value")]
pub struct ProjectStatusChanged {
    #[topic]
    project_id: u32,
    active: bool,
}

#[contractevent(data_format = "single-value")]
pub struct ProjectSupported {
    #[topic]
    project_id: u32,
    supporter: Address,
    token: Address,
    amount: i128,
    total_supported: i128,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Support amount must be positive.
    InvalidAmount = 1,
    /// Name must be non-empty and <= `MAX_NAME_LEN` bytes.
    InvalidName = 2,
    /// Description must be <= `MAX_DESCRIPTION_LEN` bytes.
    InvalidDescription = 3,
    /// Metadata URI must be <= `MAX_METADATA_URI_LEN` bytes.
    InvalidMetadataUri = 4,
    /// No project exists with the given id.
    ProjectNotFound = 5,
    /// The caller is not the project's creator.
    Unauthorized = 6,
    /// The project is archived and cannot receive support.
    ProjectInactive = 7,
    /// Arithmetic overflow while updating balances.
    ArithmeticOverflow = 8,
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

fn read_project(env: &Env, id: u32) -> Result<Project, Error> {
    let key = DataKey::Project(id);
    env.storage()
        .persistent()
        .get::<DataKey, Project>(&key)
        .ok_or(Error::ProjectNotFound)
}

fn write_project(env: &Env, project: &Project) {
    let key = DataKey::Project(project.id);
    env.storage().persistent().set(&key, project);
    env.storage()
        .persistent()
        .extend_ttl(&key, PROJECT_LIFETIME_THRESHOLD, PROJECT_BUMP_AMOUNT);
}

fn read_creator_projects(env: &Env, creator: &Address) -> Vec<u32> {
    let key = DataKey::CreatorProjects(creator.clone());
    env.storage()
        .persistent()
        .get::<DataKey, Vec<u32>>(&key)
        .unwrap_or_else(|| Vec::new(env))
}

fn add_creator_project(env: &Env, creator: &Address, project_id: u32) {
    let key = DataKey::CreatorProjects(creator.clone());
    let mut projects = read_creator_projects(env, creator);
    projects.push_back(project_id);
    env.storage().persistent().set(&key, &projects);
    env.storage()
        .persistent()
        .extend_ttl(&key, PROJECT_LIFETIME_THRESHOLD, PROJECT_BUMP_AMOUNT);
}

fn read_history(env: &Env, project_id: u32) -> Vec<SupportEntry> {
    let key = DataKey::SupportHistory(project_id);
    env.storage()
        .persistent()
        .get::<DataKey, Vec<SupportEntry>>(&key)
        .unwrap_or_else(|| Vec::new(env))
}

/// Appends a support entry, dropping the oldest entry once the ledger reaches
/// `MAX_HISTORY` so storage stays bounded.
fn append_history(env: &Env, project_id: u32, entry: SupportEntry) {
    let key = DataKey::SupportHistory(project_id);
    let mut history = read_history(env, project_id);
    if history.len() >= MAX_HISTORY {
        let mut trimmed: Vec<SupportEntry> = Vec::new(env);
        for i in 1..history.len() {
            trimmed.push_back(history.get(i).unwrap());
        }
        history = trimmed;
    }
    history.push_back(entry);
    env.storage().persistent().set(&key, &history);
    env.storage()
        .persistent()
        .extend_ttl(&key, PROJECT_LIFETIME_THRESHOLD, PROJECT_BUMP_AMOUNT);
}

/// Bounded on-chain metadata: short name, short description, short URI.
fn validate_metadata(name: &String, description: &String, metadata_uri: &String) -> Result<(), Error> {
    if name.len() == 0 || name.len() > MAX_NAME_LEN {
        return Err(Error::InvalidName);
    }
    if description.len() > MAX_DESCRIPTION_LEN {
        return Err(Error::InvalidDescription);
    }
    if metadata_uri.len() > MAX_METADATA_URI_LEN {
        return Err(Error::InvalidMetadataUri);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct Registry;

#[contractimpl]
impl Registry {
    /// Registers a new project.
    ///
    /// # Arguments
    /// * `creator` - Address registering the project; becomes its controller
    /// * `name` - Short public name (1..=`MAX_NAME_LEN` bytes)
    /// * `description` - Short description (<= `MAX_DESCRIPTION_LEN` bytes)
    /// * `metadata_uri` - Off-chain pointer to the full project profile
    /// * `recipient` - Wallet that receives funding for the project
    ///
    /// # Errors
    /// * `InvalidName` - empty or over-long name
    /// * `InvalidDescription` - over-long description
    /// * `InvalidMetadataUri` - over-long metadata URI
    pub fn register_project(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        metadata_uri: String,
        recipient: Address,
    ) -> Result<u32, Error> {
        creator.require_auth();
        bump_instance(&env);
        validate_metadata(&name, &description, &metadata_uri)?;

        let id = next_id(&env);
        let project = Project {
            id,
            creator: creator.clone(),
            name: name.clone(),
            description: description.clone(),
            metadata_uri: metadata_uri.clone(),
            recipient: recipient.clone(),
            active: true,
            total_supported: 0,
            created_at: env.ledger().timestamp(),
        };
        write_project(&env, &project);
        env.storage()
            .persistent()
            .set(&DataKey::NextId, &id.checked_add(1).ok_or(Error::ArithmeticOverflow)?);
        add_creator_project(&env, &creator, id);

        ProjectRegistered {
            project_id: id,
            creator,
            name,
            recipient,
            metadata_uri,
        }
        .publish(&env);
        Ok(id)
    }

    /// Updates a project's on-chain metadata.
    ///
    /// Only the project's creator may update it. Length bounds are the same as
    /// `register_project`; anything large still belongs behind `metadata_uri`.
    pub fn update_project(
        env: Env,
        creator: Address,
        project_id: u32,
        name: String,
        description: String,
        metadata_uri: String,
    ) -> Result<(), Error> {
        let mut project = read_project(&env, project_id)?;
        creator.require_auth();
        bump_instance(&env);
        if project.creator != creator {
            return Err(Error::Unauthorized);
        }
        validate_metadata(&name, &description, &metadata_uri)?;
        project.name = name.clone();
        project.description = description.clone();
        project.metadata_uri = metadata_uri.clone();
        write_project(&env, &project);
        ProjectUpdated {
            project_id,
            name,
            metadata_uri,
        }
        .publish(&env);
        Ok(())
    }

    /// Archives or reactivates a project. Only the creator may change status;
    /// archived projects cannot receive support.
    pub fn set_project_active(
        env: Env,
        creator: Address,
        project_id: u32,
        active: bool,
    ) -> Result<(), Error> {
        let mut project = read_project(&env, project_id)?;
        creator.require_auth();
        bump_instance(&env);
        if project.creator != creator {
            return Err(Error::Unauthorized);
        }
        project.active = active;
        write_project(&env, &project);
        ProjectStatusChanged { project_id, active }.publish(&env);
        Ok(())
    }

    /// Returns the full on-chain state of a project.
    pub fn project_details(env: Env, project_id: u32) -> Result<Project, Error> {
        bump_instance(&env);
        read_project(&env, project_id)
    }

    /// Returns the ids of all projects registered by `creator`.
    pub fn my_projects(env: Env, creator: Address) -> Vec<u32> {
        bump_instance(&env);
        read_creator_projects(&env, &creator)
    }

    /// Paginated listing of all projects ("view projects").
    ///
    /// Returns up to `limit` (capped at `MAX_LIST_LIMIT`) projects starting at
    /// `start`. A start index at or beyond the project count returns an empty
    /// list rather than an error.
    pub fn list_projects(env: Env, start: u32, limit: u32) -> Vec<Project> {
        bump_instance(&env);
        let count = next_id(&env);
        let limit = limit.min(MAX_LIST_LIMIT);
        let mut out: Vec<Project> = Vec::new(&env);
        let mut i = start;
        while i < count && out.len() < limit {
            if let Ok(project) = read_project(&env, i) {
                out.push_back(project);
            }
            i = i.checked_add(1).unwrap_or(count);
        }
        out
    }

    /// Returns the number of projects registered so far (ids are 0-indexed).
    pub fn project_count(env: Env) -> u32 {
        bump_instance(&env);
        next_id(&env)
    }

    /// Supports (donates to) a project.
    ///
    /// # Arguments
    /// * `project_id` - Id of the project to support
    /// * `supporter` - Account making the donation
    /// * `token` - Token contract the donation is paid in
    /// * `amount` - Amount to donate (token base units)
    ///
    /// # Security
    /// Tokens move directly from the supporter's wallet to the project's
    /// `recipient` wallet via the token contract's `transfer` host function,
    /// which authenticates the supporter. The registry only records the
    /// donation; it never takes custody of funds.
    pub fn support_project(
        env: Env,
        project_id: u32,
        supporter: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        let mut project = read_project(&env, project_id)?;
        supporter.require_auth();
        bump_instance(&env);
        if !project.active {
            return Err(Error::ProjectInactive);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Direct supporter -> recipient transfer; the token contract
        // authenticates the supporter for this transfer.
        TokenClient::new(&env, &token).transfer(&supporter, &project.recipient, &amount);

        project.total_supported = project
            .total_supported
            .checked_add(amount)
            .ok_or(Error::ArithmeticOverflow)?;
        let total_supported = project.total_supported;
        write_project(&env, &project);
        append_history(
            &env,
            project_id,
            SupportEntry {
                supporter: supporter.clone(),
                token: token.clone(),
                amount,
                timestamp: env.ledger().timestamp(),
            },
        );

        ProjectSupported {
            project_id,
            supporter,
            token,
            amount,
            total_supported,
        }
        .publish(&env);
        Ok(())
    }

    /// Returns the on-chain support history for a project (newest last, capped
    /// at `MAX_HISTORY` entries).
    pub fn support_history(env: Env, project_id: u32) -> Result<Vec<SupportEntry>, Error> {
        bump_instance(&env);
        read_project(&env, project_id)?;
        Ok(read_history(&env, project_id))
    }
}
