#![cfg(test)]

//! Integration tests for CrackdVault.
//!
//! Every test uses a freshly-registered StellarAssetContract (SAC) to
//! simulate native-XLM token behaviour, with `env.mock_all_auths()` so the
//! auth-required calls succeed without real signatures.
//!
//! Tests cover the whole public API plus the boundary conditions that
//! caused real bugs during design review: daily cap clamp, pool drain
//! protection, re-init guard, and leaderboard ordering.

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient as TokenAdminClient},
    Address, Env,
};

use crate::{CrackdVault, CrackdVaultClient};

const STROOPS: i128 = 10_000_000; // 1 XLM

struct Harness<'a> {
    env: Env,
    admin: Address,
    token_id: Address,
    #[allow(dead_code)]
    token_admin: TokenAdminClient<'a>,
    token: TokenClient<'a>,
    vault: CrackdVaultClient<'a>,
    vault_id: Address,
}

fn setup<'a>() -> Harness<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let sac_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let token_id = sac.address();
    let token_admin = TokenAdminClient::new(&env, &token_id);
    let token = TokenClient::new(&env, &token_id);

    let admin = Address::generate(&env);
    // Fund admin so initial_pool transfer succeeds
    token_admin.mint(&admin, &(1_000_000 * STROOPS));

    let vault_id = env.register(CrackdVault, ());
    let vault = CrackdVaultClient::new(&env, &vault_id);

    Harness { env, admin, token_id, token_admin, token, vault, vault_id }
}

fn fund_player(h: &Harness, amount: i128) -> Address {
    let p = Address::generate(&h.env);
    h.token_admin.mint(&p, &amount);
    p
}

// ------------------------------ init ------------------------------

#[test]
fn initialize_sets_state_and_funds_pool() {
    let h = setup();
    let initial = 500 * STROOPS;
    h.vault.initialize(&h.admin, &h.token_id, &initial);

    assert_eq!(h.vault.get_admin(), h.admin);
    assert_eq!(h.vault.get_token(), h.token_id);
    assert_eq!(h.vault.get_pool_balance(), initial);
    assert_eq!(h.token.balance(&h.vault_id), initial);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // AlreadyInitialized
fn reinit_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &0);
    h.vault.initialize(&h.admin, &h.token_id, &0);
}

// ------------------------------ stake / resolve ------------------------------

#[test]
fn stake_moves_xlm_into_pool() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 50 * STROOPS);

    h.vault.stake(&p, &(10 * STROOPS));
    assert_eq!(h.vault.get_pool_balance(), 110 * STROOPS);
    assert_eq!(h.token.balance(&p), 40 * STROOPS);
    assert_eq!(h.token.balance(&h.vault_id), 110 * STROOPS);
}

#[test]
fn resolve_win_3_guesses_pays_2x_bonus() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 50 * STROOPS);
    let stake = 10 * STROOPS;

    h.vault.stake(&p, &stake);
    let bonus = h.vault.resolve_win(&p, &stake, &3u32);
    // 2.0x → bonus = 20 XLM (in addition to stake returned)
    assert_eq!(bonus, 20 * STROOPS);
    // Player receives stake + bonus = 30 XLM (on top of 40 remaining)
    assert_eq!(h.token.balance(&p), 70 * STROOPS);
    // Pool was 110, -stake -bonus = 80
    assert_eq!(h.vault.get_pool_balance(), 80 * STROOPS);

    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.wins, 1);
    assert_eq!(s.losses, 0);
    assert_eq!(s.games_played, 1);
    assert_eq!(s.total_earned, 20 * STROOPS);
    assert_eq!(s.current_streak, 1);
    assert_eq!(s.best_streak, 1);
}

#[test]
fn resolve_win_5_guesses_pays_1_5x() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 50 * STROOPS);
    let stake = 10 * STROOPS;
    h.vault.stake(&p, &stake);
    let bonus = h.vault.resolve_win(&p, &stake, &5u32);
    assert_eq!(bonus, 15 * STROOPS);
}

#[test]
fn resolve_win_7_guesses_pays_1x() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 50 * STROOPS);
    let stake = 10 * STROOPS;
    h.vault.stake(&p, &stake);
    let bonus = h.vault.resolve_win(&p, &stake, &7u32);
    assert_eq!(bonus, 10 * STROOPS);
}

#[test]
fn resolve_win_9_guesses_pays_0_75x() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(400 * STROOPS));
    let p = fund_player(&h, 50 * STROOPS);
    let stake = 10 * STROOPS;
    h.vault.stake(&p, &stake);
    // Pool = 410, cap = 102.5 XLM. Bonus 0.75x of 10 = 7.5 XLM (not clamped).
    let bonus = h.vault.resolve_win(&p, &stake, &9u32);
    assert_eq!(bonus, 75_000_000); // 7.5 XLM in stroops
}

#[test]
fn resolve_loss_updates_stats_and_keeps_stake() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 50 * STROOPS);
    h.vault.stake(&p, &(10 * STROOPS));

    h.vault.resolve_loss(&p);
    assert_eq!(h.vault.get_pool_balance(), 110 * STROOPS); // stake kept
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.losses, 1);
    assert_eq!(s.wins, 0);
    assert_eq!(s.current_streak, 0);
    assert_eq!(s.games_played, 1);
}

#[test]
fn streak_resets_on_loss() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(1_000 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);

    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_win(&p, &(1 * STROOPS), &3u32);
    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_win(&p, &(1 * STROOPS), &3u32);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.current_streak, 2);
    assert_eq!(s.best_streak, 2);

    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_loss(&p);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.current_streak, 0);
    assert_eq!(s.best_streak, 2); // preserved
}

// ------------------------------ daily cap ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // DailyCapReached
fn daily_cap_reached_panics() {
    let h = setup();
    // Pool 100 XLM; player stakes 20 → pool becomes 120; cap = 30 XLM.
    // Desired bonus for 2x of 20 = 40; clamped to 30.
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);

    h.vault.stake(&p, &(20 * STROOPS));
    let got = h.vault.resolve_win(&p, &(20 * STROOPS), &3u32);
    assert_eq!(got, 30 * STROOPS);

    // Pool now 70. Stake 20 → 90. Cap = 22.5 < already_won (30) → panic.
    h.vault.stake(&p, &(20 * STROOPS));
    h.vault.resolve_win(&p, &(20 * STROOPS), &3u32);
}

#[test]
fn daily_cap_rolls_after_24h() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);

    h.vault.stake(&p, &(20 * STROOPS));
    let _ = h.vault.resolve_win(&p, &(20 * STROOPS), &3u32); // hits cap

    // Jump ~27h + enough ledgers for the temp `PlayerWinnings` entry (26.4h
    // TTL) to expire, so the new daily window starts fresh.
    h.env.ledger().set(LedgerInfo {
        timestamp: h.env.ledger().timestamp() + 27 * 3600,
        protocol_version: h.env.ledger().protocol_version(),
        sequence_number: h.env.ledger().sequence() + 25_000,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6_312_000,
    });

    // Should succeed — new daily window
    h.vault.stake(&p, &(1 * STROOPS));
    let _ = h.vault.resolve_win(&p, &(1 * STROOPS), &3u32);
}

// ------------------------------ insufficient pool ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // InsufficientPool
fn insufficient_pool_panics() {
    let h = setup();
    // Pool = 1 XLM, player stakes 1 XLM. Pool has 2 XLM.
    // 2x bonus = 2 XLM. Transfer = 1 + 2 = 3. Pool short by 1. But capped by 25%
    // first: cap = 0.5, so bonus clamps to 0.5, transfer = 1.5, pool 2 → OK.
    // Use a scenario that actually fails: tiny initial pool, big stake.
    h.vault.initialize(&h.admin, &h.token_id, &(1 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);
    // Stake 100 XLM — pool = 101. Bonus desired = 200, clamped to cap=25.25.
    // Transfer needs 100 + 25 ≈ 125, pool only 101 → InsufficientPool.
    h.vault.stake(&p, &(100 * STROOPS));
    h.vault.resolve_win(&p, &(100 * STROOPS), &3u32);
}

// ------------------------------ reads / leaderboard ------------------------------

#[test]
fn get_daily_remaining_reflects_winnings() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(400 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);
    // cap = 100. No wins yet → full 100 available.
    assert_eq!(h.vault.get_daily_remaining(&p), 100 * STROOPS);

    h.vault.stake(&p, &(10 * STROOPS));
    let _ = h.vault.resolve_win(&p, &(10 * STROOPS), &3u32); // bonus 20
    // Pool now 400 + 10 - 10 - 20 = 380. Cap = 95. Won = 20. Remaining 75.
    assert_eq!(h.vault.get_daily_remaining(&p), 75 * STROOPS);
}

#[test]
fn leaderboard_orders_by_total_earned() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(10_000 * STROOPS));
    let a = fund_player(&h, 1_000 * STROOPS);
    let b = fund_player(&h, 1_000 * STROOPS);
    let c = fund_player(&h, 1_000 * STROOPS);

    // a wins 3 XLM (stake 1 → bonus 2, since wait that's wrong; use larger)
    h.vault.stake(&a, &(10 * STROOPS));
    h.vault.resolve_win(&a, &(10 * STROOPS), &3u32); // bonus 20
    h.vault.stake(&b, &(10 * STROOPS));
    h.vault.resolve_win(&b, &(10 * STROOPS), &5u32); // bonus 15
    h.vault.stake(&c, &(10 * STROOPS));
    h.vault.resolve_win(&c, &(10 * STROOPS), &7u32); // bonus 10

    let lb = h.vault.get_leaderboard();
    assert_eq!(lb.len(), 3);
    assert_eq!(lb.get(0).unwrap().player, a);
    assert_eq!(lb.get(1).unwrap().player, b);
    assert_eq!(lb.get(2).unwrap().player, c);
    assert_eq!(lb.get(0).unwrap().total_earned, 20 * STROOPS);
}

// ------------------------------ admin ops ------------------------------

#[test]
fn admin_deposit_increases_pool() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(10 * STROOPS));
    h.vault.admin_deposit(&(40 * STROOPS));
    assert_eq!(h.vault.get_pool_balance(), 50 * STROOPS);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // InvalidStake
fn zero_stake_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")] // InvalidGuessCount
fn zero_guesses_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_win(&p, &(1 * STROOPS), &0u32);
}

// =====================================================================
// Edge cases
// =====================================================================

// ------------------------------ uninitialized paths ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn stake_before_init_panics() {
    let h = setup();
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &(1 * STROOPS));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn resolve_win_before_init_panics() {
    let h = setup();
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.resolve_win(&p, &(1 * STROOPS), &3u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn resolve_loss_before_init_panics() {
    let h = setup();
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.resolve_loss(&p);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn admin_deposit_before_init_panics() {
    let h = setup();
    h.vault.admin_deposit(&(10 * STROOPS));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn get_admin_before_init_panics() {
    let h = setup();
    let _ = h.vault.get_admin();
}

// ------------------------------ bad init arguments ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // InvalidAmount
fn negative_initial_pool_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &-1);
}

#[test]
fn zero_initial_pool_is_valid() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &0);
    assert_eq!(h.vault.get_pool_balance(), 0);
}

// ------------------------------ negative / bad amounts ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // InvalidStake
fn negative_stake_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &-5);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // InvalidStake
fn negative_stake_in_resolve_win_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = fund_player(&h, 10 * STROOPS);
    h.vault.resolve_win(&p, &-5, &3u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // InvalidAmount
fn zero_admin_deposit_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    h.vault.admin_deposit(&0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // InvalidAmount
fn negative_admin_deposit_panics() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    h.vault.admin_deposit(&-1);
}

// ------------------------------ pool math edge cases ------------------------------

#[test]
fn resolve_loss_for_fresh_player_starts_stats() {
    // Losing without prior stake is still valid — admin might call
    // resolve_loss for book-keeping. Stats should initialise correctly.
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = Address::generate(&h.env);
    h.vault.resolve_loss(&p);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.losses, 1);
    assert_eq!(s.games_played, 1);
    assert_eq!(s.wins, 0);
    assert_eq!(s.current_streak, 0);
}

#[test]
fn daily_remaining_zero_when_pool_empty() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &0);
    let p = Address::generate(&h.env);
    assert_eq!(h.vault.get_daily_remaining(&p), 0);
}

#[test]
fn multiple_wins_accumulate_earnings() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(10_000 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);

    let mut total_bonus: i128 = 0;
    for _ in 0..5 {
        h.vault.stake(&p, &(1 * STROOPS));
        total_bonus += h.vault.resolve_win(&p, &(1 * STROOPS), &7u32); // 1x tier
    }
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.wins, 5);
    assert_eq!(s.total_earned, total_bonus);
    assert_eq!(s.current_streak, 5);
    assert_eq!(s.best_streak, 5);
}

#[test]
fn best_streak_preserved_across_mixed_results() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(1_000 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);
    // W W W L W → current = 1, best = 3
    for _ in 0..3 {
        h.vault.stake(&p, &(1 * STROOPS));
        h.vault.resolve_win(&p, &(1 * STROOPS), &7u32);
    }
    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_loss(&p);
    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_win(&p, &(1 * STROOPS), &7u32);

    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.current_streak, 1);
    assert_eq!(s.best_streak, 3);
    assert_eq!(s.wins, 4);
    assert_eq!(s.losses, 1);
    assert_eq!(s.games_played, 5);
}

// ------------------------------ leaderboard edges ------------------------------

#[test]
fn leaderboard_empty_before_any_wins() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let lb = h.vault.get_leaderboard();
    assert_eq!(lb.len(), 0);
}

#[test]
fn leaderboard_caps_at_10_entries() {
    let h = setup();
    // Large pool so 15 small wins don't drain it.
    h.vault.initialize(&h.admin, &h.token_id, &(100_000 * STROOPS));

    // 15 distinct players, each winning a different amount so ordering
    // is unambiguous. Player i wins (i+1) * 1 XLM.
    for i in 0..15u32 {
        let p = fund_player(&h, 100 * STROOPS);
        let stake = ((i + 1) as i128) * STROOPS;
        h.vault.stake(&p, &stake);
        // Use 7 guesses → 1.0x multiplier → bonus = stake
        h.vault.resolve_win(&p, &stake, &7u32);
    }
    let lb = h.vault.get_leaderboard();
    assert_eq!(lb.len(), 10);
    // Top entry earned the most (last inserted = stake 15 XLM).
    assert_eq!(lb.get(0).unwrap().total_earned, 15 * STROOPS);
    assert_eq!(lb.get(9).unwrap().total_earned, 6 * STROOPS);
}

#[test]
fn leaderboard_updates_in_place_on_repeat_wins() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(1_000 * STROOPS));
    let a = fund_player(&h, 1_000 * STROOPS);
    let b = fund_player(&h, 1_000 * STROOPS);

    h.vault.stake(&a, &(1 * STROOPS));
    h.vault.resolve_win(&a, &(1 * STROOPS), &7u32); // a earns 1
    h.vault.stake(&b, &(1 * STROOPS));
    h.vault.resolve_win(&b, &(1 * STROOPS), &3u32); // b earns 2 → now ahead

    let lb = h.vault.get_leaderboard();
    assert_eq!(lb.len(), 2);
    assert_eq!(lb.get(0).unwrap().player, b);
    assert_eq!(lb.get(1).unwrap().player, a);

    // A wins again, big bonus → overtakes
    h.vault.stake(&a, &(5 * STROOPS));
    h.vault.resolve_win(&a, &(5 * STROOPS), &3u32); // +10

    let lb = h.vault.get_leaderboard();
    assert_eq!(lb.get(0).unwrap().player, a);
    assert_eq!(lb.len(), 2); // no duplicate entry for a
}

// ------------------------------ idempotence / re-reads ------------------------------

#[test]
fn stats_read_for_unknown_player_returns_zeroes() {
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(100 * STROOPS));
    let p = Address::generate(&h.env);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.wins, 0);
    assert_eq!(s.losses, 0);
    assert_eq!(s.total_earned, 0);
    assert_eq!(s.best_streak, 0);
    assert_eq!(s.current_streak, 0);
    assert_eq!(s.games_played, 0);
}

#[test]
fn daily_remaining_reflects_cumulative_wins() {
    // Multiple small wins sum against the daily cap correctly.
    let h = setup();
    h.vault.initialize(&h.admin, &h.token_id, &(400 * STROOPS));
    let p = fund_player(&h, 1_000 * STROOPS);

    // Win 1: stake 1, bonus 2 (2x tier).
    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_win(&p, &(1 * STROOPS), &3u32);

    // Win 2: stake 1, bonus 2 again.
    h.vault.stake(&p, &(1 * STROOPS));
    h.vault.resolve_win(&p, &(1 * STROOPS), &3u32);

    // Cumulative won = 4 XLM.
    let remaining = h.vault.get_daily_remaining(&p);
    let pool = h.vault.get_pool_balance();
    let cap = pool / 4;
    assert_eq!(remaining, cap - 4 * STROOPS);
}
