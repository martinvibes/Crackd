#![no_std]
//! CrackdVault — multi-asset community prize-pool contract for vs-AI games.
//!
//! One contract instance serves any number of assets. Each asset has its
//! own independent pool, daily-cap window, and leaderboard. Unified
//! gameplay stats (wins/losses/streaks) are tracked per player and are
//! denomination-agnostic.
//!
//! ## Flow (vs-AI staked, per asset)
//! 1. Player signs `stake(player, token, amount)` → the asset moves
//!    into the per-token pool.
//! 2. Game plays out off-chain.
//! 3. Admin signs either:
//!    - `resolve_win(player, token, stake, guesses_used)` → pays stake
//!      + bonus in that asset, capped at 25% of that asset's pool per
//!      player per 24h.
//!    - `resolve_loss(player)` → stake stays in pool; unified stats updated.

mod errors;
mod events;
mod rewards;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, Env, Map, Vec};

use errors::VaultError;
use types::{LeaderboardEntry, PlayerStats};

/// Max number of players held in each per-asset leaderboard. Keeps the
/// linear-scan on insert cheap.
const LEADERBOARD_SIZE: u32 = 10;

/// 24 hours in seconds — daily reset window for per-player winnings.
const ONE_DAY_SECS: u64 = 86_400;

#[contract]
pub struct CrackdVault;

#[contractimpl]
impl CrackdVault {
    // ---------- Admin lifecycle ----------

    /// One-shot initializer. Panics on re-init.
    pub fn initialize(env: Env, admin: Address) {
        if storage::get_admin(&env).is_some() {
            panic_with_error!(&env, VaultError::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::bump_instance(&env);

        events::initialized(&env, &admin);
    }

    /// Admin tops up a specific asset's pool from their wallet.
    pub fn admin_deposit(env: Env, token: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }
        let admin = require_admin(&env);

        token::Client::new(&env, &token).transfer(
            &admin,
            &env.current_contract_address(),
            &amount,
        );
        let new_balance = storage::get_pool_balance(&env, &token) + amount;
        storage::set_pool_balance(&env, &token, new_balance);
        // Initialize the daily-reset pointer on first touch of an asset.
        if storage::get_last_reset(&env, &token) == 0 {
            storage::set_last_reset(&env, &token, env.ledger().timestamp());
        }
        storage::bump_instance(&env);

        events::topup(&env, &token, &admin, amount, new_balance);
    }

    // ---------- Player-driven: staking ----------

    /// Player locks `amount` of `token` into that asset's pool.
    pub fn stake(env: Env, player: Address, token: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, VaultError::InvalidStake);
        }
        require_initialized(&env);
        player.require_auth();

        token::Client::new(&env, &token).transfer(
            &player,
            &env.current_contract_address(),
            &amount,
        );
        let new_balance = storage::get_pool_balance(&env, &token) + amount;
        storage::set_pool_balance(&env, &token, new_balance);
        if storage::get_last_reset(&env, &token) == 0 {
            storage::set_last_reset(&env, &token, env.ledger().timestamp());
        }
        storage::bump_instance(&env);

        events::staked(&env, &token, &player, amount, new_balance);
    }

    // ---------- Admin-driven: resolution ----------

    /// Admin records a loss. Stake already in the pool. Unified stats.
    pub fn resolve_loss(env: Env, player: Address) {
        require_admin(&env);

        let mut stats = storage::get_player_stats(&env, &player);
        stats.losses = stats.losses.saturating_add(1);
        stats.current_streak = 0;
        stats.games_played = stats.games_played.saturating_add(1);
        storage::set_player_stats(&env, &player, &stats);
        storage::bump_instance(&env);

        events::loss(&env, &player);
    }

    /// Admin records a win for a specific asset and pays out (stake + bonus).
    /// Returns the bonus paid (may be clamped by that asset's 25% daily cap).
    pub fn resolve_win(
        env: Env,
        player: Address,
        token: Address,
        stake: i128,
        guesses_used: u32,
    ) -> i128 {
        if stake <= 0 {
            panic_with_error!(&env, VaultError::InvalidStake);
        }
        if guesses_used == 0 {
            panic_with_error!(&env, VaultError::InvalidGuessCount);
        }
        require_admin(&env);

        maybe_roll_daily_window(&env, &token);

        let desired = rewards::gross_payout(stake, guesses_used);
        let pool = storage::get_pool_balance(&env, &token);
        let already_won = storage::get_player_winnings(&env, &token, &player);
        let (bonus, new_daily) = match rewards::apply_daily_cap(pool, already_won, desired) {
            Some(pair) => pair,
            None => panic_with_error!(&env, VaultError::DailyCapReached),
        };

        if pool < stake.saturating_add(bonus) {
            panic_with_error!(&env, VaultError::InsufficientPool);
        }

        let total_transfer = stake + bonus;
        let new_pool = pool - bonus - stake;
        storage::set_pool_balance(&env, &token, new_pool);
        storage::set_player_winnings(&env, &token, &player, new_daily);

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &player,
            &total_transfer,
        );

        // Unified stats
        let mut stats = storage::get_player_stats(&env, &player);
        stats.wins = stats.wins.saturating_add(1);
        stats.games_played = stats.games_played.saturating_add(1);
        stats.current_streak = stats.current_streak.saturating_add(1);
        if stats.current_streak > stats.best_streak {
            stats.best_streak = stats.current_streak;
        }
        storage::set_player_stats(&env, &player, &stats);
        // Per-asset earnings
        storage::add_player_earnings(&env, &player, &token, bonus);

        update_leaderboard(&env, &token, &player);
        storage::bump_instance(&env);

        events::payout(&env, &token, &player, stake, bonus, guesses_used);
        bonus
    }

    // ---------- Public reads ----------

    pub fn get_pool_balance(env: Env, token: Address) -> i128 {
        storage::get_pool_balance(&env, &token)
    }

    pub fn get_admin(env: Env) -> Address {
        require_initialized(&env);
        storage::get_admin(&env).unwrap()
    }

    pub fn get_player_stats(env: Env, player: Address) -> PlayerStats {
        storage::get_player_stats(&env, &player)
    }

    /// Full map of per-asset earnings for a player: token → stroops.
    pub fn get_player_earnings(env: Env, player: Address) -> Map<Address, i128> {
        storage::get_player_earnings_map(&env, &player)
    }

    /// How much of the given asset this player can still win today.
    pub fn get_daily_remaining(env: Env, player: Address, token: Address) -> i128 {
        let pool = storage::get_pool_balance(&env, &token);
        let cap = pool / 4;
        let won = storage::get_player_winnings(&env, &token, &player);
        if won >= cap { 0 } else { cap - won }
    }

    /// Top-N leaderboard for the given asset, ordered by earnings desc.
    pub fn get_leaderboard(env: Env, token: Address) -> Vec<LeaderboardEntry> {
        let addrs = storage::get_leaderboard_addrs(&env, &token);
        let mut out = Vec::new(&env);
        for addr in addrs.iter() {
            let s = storage::get_player_stats(&env, &addr);
            let earned = storage::get_player_earned(&env, &addr, &token);
            out.push_back(LeaderboardEntry {
                player: addr,
                total_earned: earned,
                wins: s.wins,
                best_streak: s.best_streak,
            });
        }
        out
    }
}

// ----------------------------- helpers -----------------------------

fn require_initialized(env: &Env) {
    if storage::get_admin(env).is_none() {
        panic_with_error!(env, VaultError::NotInitialized);
    }
}

fn require_admin(env: &Env) -> Address {
    let admin = match storage::get_admin(env) {
        Some(a) => a,
        None => panic_with_error!(env, VaultError::NotInitialized),
    };
    admin.require_auth();
    admin
}

/// If > 24h since last reset for this asset, advance pointer. Per-player
/// temp-storage entries self-expire around the same window.
fn maybe_roll_daily_window(env: &Env, token: &Address) {
    let now = env.ledger().timestamp();
    let last = storage::get_last_reset(env, token);
    if now >= last + ONE_DAY_SECS {
        storage::set_last_reset(env, token, now);
        events::daily_reset(env, token, now);
    }
}

/// Keep the per-asset leaderboard in sync. Insert the player (if new) and
/// re-rank by their earnings-in-that-asset. Cap at LEADERBOARD_SIZE.
fn update_leaderboard(env: &Env, token: &Address, player: &Address) {
    let existing = storage::get_leaderboard_addrs(env, token);

    // Build (addr, earnings) pairs with the winner's new earnings applied.
    let mut pairs: Vec<(Address, i128)> = Vec::new(env);
    let mut inserted = false;
    for addr in existing.iter() {
        let earned = storage::get_player_earned(env, &addr, token);
        if addr == *player {
            inserted = true;
        }
        pairs.push_back((addr, earned));
    }
    if !inserted {
        let earned = storage::get_player_earned(env, player, token);
        pairs.push_back((player.clone(), earned));
    }

    // Selection sort desc; N <= 11 so simple is fine.
    let n = pairs.len();
    let mut sorted: Vec<Address> = Vec::new(env);
    let mut used: Vec<u32> = Vec::new(env);
    for _ in 0..n {
        let mut best_i: Option<u32> = None;
        let mut best_v: i128 = i128::MIN;
        for i in 0..n {
            if used.iter().any(|u| u == i) {
                continue;
            }
            let (_, v) = pairs.get(i).unwrap();
            if v > best_v {
                best_v = v;
                best_i = Some(i);
            }
        }
        if let Some(i) = best_i {
            let (a, _) = pairs.get(i).unwrap();
            sorted.push_back(a);
            used.push_back(i);
        }
    }

    let mut capped: Vec<Address> = Vec::new(env);
    let limit = LEADERBOARD_SIZE.min(sorted.len());
    for i in 0..limit {
        capped.push_back(sorted.get(i).unwrap());
    }
    storage::set_leaderboard_addrs(env, token, &capped);
}
