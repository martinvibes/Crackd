//! Typed wrappers around contract storage with sensible TTL policies.
//!
//! - **Instance** storage: admin, token, pool balance, reset time, leaderboard.
//!   Loaded on every call anyway, so co-locate with contract instance.
//! - **Persistent** storage: per-player stats — we want these to outlive any
//!   TTL horizon and be kept alive as long as the player keeps playing.
//! - **Temporary** storage: per-player daily winnings. TTL = just over 24h
//!   so the next-day window starts with a clean slate automatically.
use soroban_sdk::{Address, Env, Vec};

use crate::types::{DataKey, PlayerStats};

// -- TTL policy -------------------------------------------------------------

/// Bump window for instance/persistent entries (approx 30 days of ledgers
/// at 5s per ledger = 518_400). Callers bump back up to `BUMP_HIGH` whenever
/// they touch an entry, and the contract only errors if the current TTL has
/// already dropped below `BUMP_LOW`.
const BUMP_LOW: u32 = 100_000;   // ~5.7 days
const BUMP_HIGH: u32 = 518_400;  // ~30 days

/// Temporary storage window for daily winnings. Just above 24h so the
/// window resets on its own without a sweep loop.
const DAILY_TTL_LOW: u32 = 17_280;   // 24h at 5s ledgers
const DAILY_TTL_HIGH: u32 = 19_008;  // ~26.4h — a bit of slack

// -- Admin ------------------------------------------------------------------

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

// -- Token (SAC address for native XLM) -------------------------------------

pub fn set_token(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::Token, token);
}

pub fn get_token(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Token)
}

// -- Pool balance -----------------------------------------------------------

pub fn get_pool_balance(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::PoolBalance)
        .unwrap_or(0)
}

pub fn set_pool_balance(env: &Env, amount: i128) {
    env.storage().instance().set(&DataKey::PoolBalance, &amount);
}

// -- Reset timer ------------------------------------------------------------

pub fn get_last_reset(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::LastResetTime)
        .unwrap_or(0)
}

pub fn set_last_reset(env: &Env, ts: u64) {
    env.storage().instance().set(&DataKey::LastResetTime, &ts);
}

// -- Player daily winnings (temporary, 24h TTL) -----------------------------

pub fn get_player_winnings(env: &Env, player: &Address) -> i128 {
    let key = DataKey::PlayerWinnings(player.clone());
    env.storage().temporary().get(&key).unwrap_or(0)
}

pub fn set_player_winnings(env: &Env, player: &Address, amount: i128) {
    let key = DataKey::PlayerWinnings(player.clone());
    env.storage().temporary().set(&key, &amount);
    env.storage()
        .temporary()
        .extend_ttl(&key, DAILY_TTL_LOW, DAILY_TTL_HIGH);
}

// -- Player stats (persistent) ---------------------------------------------

pub fn get_player_stats(env: &Env, player: &Address) -> PlayerStats {
    let key = DataKey::PlayerStats(player.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(PlayerStats::empty)
}

pub fn set_player_stats(env: &Env, player: &Address, stats: &PlayerStats) {
    let key = DataKey::PlayerStats(player.clone());
    env.storage().persistent().set(&key, stats);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_LOW, BUMP_HIGH);
}

// -- Leaderboard (instance, bounded to top N) ------------------------------

pub fn get_leaderboard_addrs(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Leaderboard)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn set_leaderboard_addrs(env: &Env, addrs: &Vec<Address>) {
    env.storage().instance().set(&DataKey::Leaderboard, addrs);
}

// -- Instance TTL bump ------------------------------------------------------

pub fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_LOW, BUMP_HIGH);
}
