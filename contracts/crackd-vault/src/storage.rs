//! Typed storage wrappers, multi-asset.
//!
//! Every pool/cap entry is keyed by the `token` SAC address, so one
//! contract instance serves XLM, USDC, and any future asset without
//! state collisions.
//!
//! TTL policy:
//! - Admin: instance (always loaded).
//! - Pool balance / reset / leaderboard: instance per-asset (cheap to bump).
//! - PlayerStats: persistent — long-lived per-player history.
//! - PlayerEarnings: persistent — per-player map of token → earnings.
//! - PlayerWinnings (daily): temporary, TTL ≈ 26h so next-day window
//!   starts clean without a sweep loop.
use soroban_sdk::{Address, Env, Map, Vec};

use crate::types::{DataKey, PlayerStats};

const BUMP_LOW: u32 = 100_000;
const BUMP_HIGH: u32 = 518_400;
const DAILY_TTL_LOW: u32 = 17_280;
const DAILY_TTL_HIGH: u32 = 19_008;

// -- Admin ------------------------------------------------------------------

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

// -- Pool balance per asset -------------------------------------------------

pub fn get_pool_balance(env: &Env, token: &Address) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::PoolBalance(token.clone()))
        .unwrap_or(0)
}
pub fn set_pool_balance(env: &Env, token: &Address, amount: i128) {
    env.storage()
        .instance()
        .set(&DataKey::PoolBalance(token.clone()), &amount);
}

// -- Daily reset pointer per asset -----------------------------------------

pub fn get_last_reset(env: &Env, token: &Address) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::LastResetTime(token.clone()))
        .unwrap_or(0)
}
pub fn set_last_reset(env: &Env, token: &Address, ts: u64) {
    env.storage()
        .instance()
        .set(&DataKey::LastResetTime(token.clone()), &ts);
}

// -- Per-asset / per-player daily winnings (temporary) ---------------------

pub fn get_player_winnings(env: &Env, token: &Address, player: &Address) -> i128 {
    let key = DataKey::PlayerWinnings(token.clone(), player.clone());
    env.storage().temporary().get(&key).unwrap_or(0)
}
pub fn set_player_winnings(env: &Env, token: &Address, player: &Address, amount: i128) {
    let key = DataKey::PlayerWinnings(token.clone(), player.clone());
    env.storage().temporary().set(&key, &amount);
    env.storage()
        .temporary()
        .extend_ttl(&key, DAILY_TTL_LOW, DAILY_TTL_HIGH);
}

// -- Unified player stats (persistent) --------------------------------------

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

// -- Per-asset earnings per player (persistent) ----------------------------

pub fn get_player_earnings_map(env: &Env, player: &Address) -> Map<Address, i128> {
    let key = DataKey::PlayerEarnings(player.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Map::new(env))
}
pub fn set_player_earnings_map(env: &Env, player: &Address, m: &Map<Address, i128>) {
    let key = DataKey::PlayerEarnings(player.clone());
    env.storage().persistent().set(&key, m);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_LOW, BUMP_HIGH);
}
pub fn add_player_earnings(env: &Env, player: &Address, token: &Address, amount: i128) {
    let mut m = get_player_earnings_map(env, player);
    let prev = m.get(token.clone()).unwrap_or(0);
    m.set(token.clone(), prev.saturating_add(amount));
    set_player_earnings_map(env, player, &m);
}
pub fn get_player_earned(env: &Env, player: &Address, token: &Address) -> i128 {
    get_player_earnings_map(env, player).get(token.clone()).unwrap_or(0)
}

// -- Per-asset leaderboard (instance) --------------------------------------

pub fn get_leaderboard_addrs(env: &Env, token: &Address) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Leaderboard(token.clone()))
        .unwrap_or_else(|| Vec::new(env))
}
pub fn set_leaderboard_addrs(env: &Env, token: &Address, addrs: &Vec<Address>) {
    env.storage()
        .instance()
        .set(&DataKey::Leaderboard(token.clone()), addrs);
}

// -- Instance TTL bump ------------------------------------------------------

pub fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_LOW, BUMP_HIGH);
}
