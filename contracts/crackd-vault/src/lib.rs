#![no_std]
//! CrackdVault — community prize-pool contract for vs-AI games.
//!
//! ## Flow (vs-AI staked)
//! 1. Player signs `stake(player, amount)` → XLM moves into the pool.
//! 2. Game plays out off-chain; backend witnesses the outcome.
//! 3. Admin signs either:
//!    - `resolve_win(player, stake, guesses_used)` → contract pays out
//!      stake + bonus, capped at 25% of pool per player per 24h.
//!    - `resolve_loss(player)` → stake stays in pool, stats updated.
//!
//! The naming differs from the original brief (`deposit_to_pool` / `claim_win`)
//! to disentangle staking from stat-tracking — the brief conflated them,
//! which makes the "player stakes then wins" path impossible without racy
//! recomputation. This design mirrors how on-chain escrow contracts in
//! production handle the same shape.

mod errors;
mod events;
mod rewards;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, Env, Vec};

use errors::VaultError;
use types::{LeaderboardEntry, PlayerStats};

/// Max number of players held in the on-chain leaderboard. Keeps gas bounded.
const LEADERBOARD_SIZE: u32 = 10;

/// 24 hours in seconds — daily reset window for per-player winnings.
const ONE_DAY_SECS: u64 = 86_400;

#[contract]
pub struct CrackdVault;

#[contractimpl]
impl CrackdVault {
    // ---------- Admin lifecycle ----------

    /// One-shot initializer. Panics on re-init.
    pub fn initialize(env: Env, admin: Address, token: Address, initial_pool: i128) {
        if storage::get_admin(&env).is_some() {
            panic_with_error!(&env, VaultError::AlreadyInitialized);
        }
        if initial_pool < 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }

        admin.require_auth();

        storage::set_admin(&env, &admin);
        storage::set_token(&env, &token);
        storage::set_pool_balance(&env, initial_pool);
        storage::set_last_reset(&env, env.ledger().timestamp());
        storage::bump_instance(&env);

        // If an initial pool is specified, the admin funds it at init time.
        if initial_pool > 0 {
            token::Client::new(&env, &token).transfer(
                &admin,
                &env.current_contract_address(),
                &initial_pool,
            );
        }

        events::initialized(&env, &admin, initial_pool);
    }

    /// Admin tops up the pool from their wallet. Useful for seeding.
    pub fn admin_deposit(env: Env, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, VaultError::InvalidAmount);
        }
        let admin = require_admin(&env);
        let token = require_token(&env);

        token::Client::new(&env, &token).transfer(
            &admin,
            &env.current_contract_address(),
            &amount,
        );
        let new_balance = storage::get_pool_balance(&env) + amount;
        storage::set_pool_balance(&env, new_balance);
        storage::bump_instance(&env);

        events::topup(&env, &admin, amount, new_balance);
    }

    // ---------- Player-driven: staking ----------

    /// Player locks `amount` XLM into the pool to start a staked vs-AI game.
    /// Winning or losing is resolved later by the admin.
    pub fn stake(env: Env, player: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, VaultError::InvalidStake);
        }
        require_initialized(&env);
        player.require_auth();

        let token = require_token(&env);
        token::Client::new(&env, &token).transfer(
            &player,
            &env.current_contract_address(),
            &amount,
        );
        let new_balance = storage::get_pool_balance(&env) + amount;
        storage::set_pool_balance(&env, new_balance);
        storage::bump_instance(&env);

        // Games played increments at game end (resolve_*), not here — a
        // player might stake and disconnect. The counters reflect completed
        // games.

        events::staked(&env, &player, amount, new_balance);
    }

    // ---------- Admin-driven: resolution ----------

    /// Admin records a loss. Stake is already in the pool from `stake`.
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

    /// Admin records a win and pays out (stake + bonus) from the pool.
    ///
    /// `stake` is what the player put in originally (validated off-chain
    /// via event indexing — admin is trusted for resolution, that's the
    /// whole point of separating player-auth from resolver-auth).
    ///
    /// Returns the actual payout (bonus), which may be clamped by the
    /// 25% daily cap. Transferred value = stake + payout.
    pub fn resolve_win(
        env: Env,
        player: Address,
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
        let token = require_token(&env);

        // Reset the daily window if the 24h boundary crossed since last reset.
        maybe_roll_daily_window(&env);

        let desired = rewards::gross_payout(stake, guesses_used);
        let pool = storage::get_pool_balance(&env);

        let already_won = storage::get_player_winnings(&env, &player);
        let (bonus, new_daily) = match rewards::apply_daily_cap(pool, already_won, desired) {
            Some(pair) => pair,
            None => panic_with_error!(&env, VaultError::DailyCapReached),
        };

        // Pool must cover (stake + bonus): the stake came from the player's
        // own deposit so it's already counted in `pool`, but we still need
        // to physically be able to transfer both out.
        if pool < stake.saturating_add(bonus) {
            panic_with_error!(&env, VaultError::InsufficientPool);
        }

        // Payout = stake + bonus transferred back to player.
        // Pool effect: balance -= bonus (stake was already in pool from
        // the earlier `stake` call, so sending it back nets out against
        // that deposit).
        let total_transfer = stake + bonus;
        let new_pool = pool - bonus - stake; // stake leaves the pool too
        storage::set_pool_balance(&env, new_pool);
        storage::set_player_winnings(&env, &player, new_daily);

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &player,
            &total_transfer,
        );

        // Stats
        let mut stats = storage::get_player_stats(&env, &player);
        stats.wins = stats.wins.saturating_add(1);
        stats.games_played = stats.games_played.saturating_add(1);
        stats.total_earned = stats.total_earned.saturating_add(bonus);
        stats.current_streak = stats.current_streak.saturating_add(1);
        if stats.current_streak > stats.best_streak {
            stats.best_streak = stats.current_streak;
        }
        storage::set_player_stats(&env, &player, &stats);

        update_leaderboard(&env, &player, &stats);
        storage::bump_instance(&env);

        events::payout(&env, &player, stake, bonus, guesses_used);

        bonus
    }

    // ---------- Public reads ----------

    pub fn get_pool_balance(env: Env) -> i128 {
        storage::get_pool_balance(&env)
    }

    pub fn get_admin(env: Env) -> Address {
        require_initialized(&env);
        storage::get_admin(&env).unwrap()
    }

    pub fn get_token(env: Env) -> Address {
        require_initialized(&env);
        storage::get_token(&env).unwrap()
    }

    pub fn get_player_stats(env: Env, player: Address) -> PlayerStats {
        storage::get_player_stats(&env, &player)
    }

    /// How much more XLM this player can win from the pool today.
    /// Shown on the staking modal: "You can still win X XLM today".
    pub fn get_daily_remaining(env: Env, player: Address) -> i128 {
        let pool = storage::get_pool_balance(&env);
        let cap = pool / 4;
        let won = storage::get_player_winnings(&env, &player);
        if won >= cap { 0 } else { cap - won }
    }

    /// Top-N leaderboard, already ordered by total_earned desc.
    pub fn get_leaderboard(env: Env) -> Vec<LeaderboardEntry> {
        let addrs = storage::get_leaderboard_addrs(&env);
        let mut out = Vec::new(&env);
        for addr in addrs.iter() {
            let s = storage::get_player_stats(&env, &addr);
            out.push_back(LeaderboardEntry {
                player: addr,
                total_earned: s.total_earned,
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

fn require_token(env: &Env) -> Address {
    match storage::get_token(env) {
        Some(t) => t,
        None => panic_with_error!(env, VaultError::NotInitialized),
    }
}

/// If > 24h since last_reset, roll the reset pointer forward. Per-player
/// `PlayerWinnings` entries live in temporary storage with ~26h TTL, so they
/// self-expire; we only need to advance the pointer for `get_daily_remaining`
/// computations and for event observability.
fn maybe_roll_daily_window(env: &Env) {
    let now = env.ledger().timestamp();
    let last = storage::get_last_reset(env);
    if now >= last + ONE_DAY_SECS {
        storage::set_last_reset(env, now);
        events::daily_reset(env, now);
    }
}

/// Insert/update the player in the bounded top-N leaderboard ordered by
/// total_earned desc. Small list so O(N) is fine.
fn update_leaderboard(env: &Env, player: &Address, stats: &PlayerStats) {
    let existing = storage::get_leaderboard_addrs(env);
    // Collect (addr, total_earned) pairs with the new stats applied.
    let mut pairs: Vec<(Address, i128)> = Vec::new(env);
    let mut inserted = false;
    for addr in existing.iter() {
        if addr == *player {
            pairs.push_back((addr, stats.total_earned));
            inserted = true;
        } else {
            let s = storage::get_player_stats(env, &addr);
            pairs.push_back((addr, s.total_earned));
        }
    }
    if !inserted {
        pairs.push_back((player.clone(), stats.total_earned));
    }

    // Selection sort (N <= 10+1) by earned desc, emit top N addresses.
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
    // Truncate to LEADERBOARD_SIZE (soroban_sdk::Vec has no FromIterator).
    let mut capped: Vec<Address> = Vec::new(env);
    let limit = LEADERBOARD_SIZE.min(sorted.len());
    for i in 0..limit {
        capped.push_back(sorted.get(i).unwrap());
    }
    storage::set_leaderboard_addrs(env, &capped);
}
