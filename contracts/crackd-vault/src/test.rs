#![cfg(test)]

//! Integration tests for CrackdVault — multi-asset.

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient as TokenAdminClient},
    Address, Env,
};

use crate::{CrackdVault, CrackdVaultClient};

const STROOPS: i128 = 10_000_000; // 1 token unit (both XLM and USDC are 7-decimal)

struct Asset<'a> {
    id: Address,
    admin: TokenAdminClient<'a>,
    client: TokenClient<'a>,
}

struct Harness<'a> {
    env: Env,
    admin: Address,
    xlm: Asset<'a>,
    usdc: Asset<'a>,
    vault: CrackdVaultClient<'a>,
    vault_id: Address,
}

fn register_asset<'a>(env: &Env) -> Asset<'a> {
    let issuer = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let id = sac.address();
    Asset {
        admin: TokenAdminClient::new(env, &id),
        client: TokenClient::new(env, &id),
        id,
    }
}

fn setup<'a>() -> Harness<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let xlm = register_asset(&env);
    let usdc = register_asset(&env);
    let admin = Address::generate(&env);
    let vault_id = env.register(CrackdVault, ());
    let vault = CrackdVaultClient::new(&env, &vault_id);
    vault.initialize(&admin);
    Harness { env, admin, xlm, usdc, vault, vault_id }
}

fn fund(asset: &Asset, who: &Address, amount: i128) {
    asset.admin.mint(who, &amount);
}

fn new_player(h: &Harness, amount_per_asset: i128) -> Address {
    let p = Address::generate(&h.env);
    fund(&h.xlm, &p, amount_per_asset);
    fund(&h.usdc, &p, amount_per_asset);
    p
}

// ------------------------------ init ------------------------------

#[test]
fn initialize_sets_admin_only() {
    let h = setup();
    assert_eq!(h.vault.get_admin(), h.admin);
    assert_eq!(h.vault.get_pool_balance(&h.xlm.id), 0);
    assert_eq!(h.vault.get_pool_balance(&h.usdc.id), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // AlreadyInitialized
fn reinit_panics() {
    let h = setup();
    h.vault.initialize(&h.admin);
}

// ------------------------------ pools are independent ------------------------------

#[test]
fn xlm_and_usdc_pools_are_independent() {
    let h = setup();
    let p = new_player(&h, 100 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    h.vault.stake(&p, &h.usdc.id, &(5 * STROOPS));

    assert_eq!(h.vault.get_pool_balance(&h.xlm.id), 10 * STROOPS);
    assert_eq!(h.vault.get_pool_balance(&h.usdc.id), 5 * STROOPS);
    assert_eq!(h.xlm.client.balance(&h.vault_id), 10 * STROOPS);
    assert_eq!(h.usdc.client.balance(&h.vault_id), 5 * STROOPS);
}

#[test]
fn resolve_win_only_pays_from_target_asset_pool() {
    let h = setup();
    let p = new_player(&h, 1_000 * STROOPS);

    // Seed both pools
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    fund(&h.usdc, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    h.vault.admin_deposit(&h.usdc.id, &(100 * STROOPS));

    let stake = 10 * STROOPS;
    h.vault.stake(&p, &h.xlm.id, &stake);
    let bonus = h.vault.resolve_win(&p, &h.xlm.id, &stake, &3u32);
    assert_eq!(bonus, 20 * STROOPS);

    // USDC pool untouched
    assert_eq!(h.vault.get_pool_balance(&h.usdc.id), 100 * STROOPS);
    // XLM pool: 100 + 10 stake - 10 stake returned - 20 bonus = 80
    assert_eq!(h.vault.get_pool_balance(&h.xlm.id), 80 * STROOPS);
}

#[test]
fn daily_cap_is_per_asset() {
    let h = setup();
    let p = new_player(&h, 1_000 * STROOPS);
    // Pools of 100 each → cap 30 once the 20-stake lands.
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    fund(&h.usdc, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    h.vault.admin_deposit(&h.usdc.id, &(100 * STROOPS));

    // Hit cap in XLM
    h.vault.stake(&p, &h.xlm.id, &(20 * STROOPS));
    let got = h.vault.resolve_win(&p, &h.xlm.id, &(20 * STROOPS), &3u32);
    assert_eq!(got, 30 * STROOPS);

    // Same player still has USDC daily allowance
    h.vault.stake(&p, &h.usdc.id, &(20 * STROOPS));
    let got_usdc = h.vault.resolve_win(&p, &h.usdc.id, &(20 * STROOPS), &3u32);
    assert_eq!(got_usdc, 30 * STROOPS);
}

#[test]
fn per_asset_earnings_recorded_separately() {
    let h = setup();
    let p = new_player(&h, 1_000 * STROOPS);
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    fund(&h.usdc, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    h.vault.admin_deposit(&h.usdc.id, &(100 * STROOPS));

    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    h.vault.resolve_win(&p, &h.xlm.id, &(10 * STROOPS), &3u32); // +20 XLM
    h.vault.stake(&p, &h.usdc.id, &(10 * STROOPS));
    h.vault.resolve_win(&p, &h.usdc.id, &(10 * STROOPS), &5u32); // +15 USDC

    let earnings = h.vault.get_player_earnings(&p);
    assert_eq!(earnings.get(h.xlm.id.clone()).unwrap_or(0), 20 * STROOPS);
    assert_eq!(earnings.get(h.usdc.id.clone()).unwrap_or(0), 15 * STROOPS);

    // Unified gameplay stats: 2 wins total across assets
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.wins, 2);
    assert_eq!(s.games_played, 2);
    assert_eq!(s.current_streak, 2);
}

#[test]
fn leaderboards_are_per_asset() {
    let h = setup();
    fund(&h.xlm, &h.admin, 10_000 * STROOPS);
    fund(&h.usdc, &h.admin, 10_000 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(10_000 * STROOPS));
    h.vault.admin_deposit(&h.usdc.id, &(10_000 * STROOPS));

    let alice = new_player(&h, 1_000 * STROOPS);
    let bob = new_player(&h, 1_000 * STROOPS);

    // Alice dominates XLM
    h.vault.stake(&alice, &h.xlm.id, &(10 * STROOPS));
    h.vault.resolve_win(&alice, &h.xlm.id, &(10 * STROOPS), &3u32); // +20
    // Bob dominates USDC
    h.vault.stake(&bob, &h.usdc.id, &(10 * STROOPS));
    h.vault.resolve_win(&bob, &h.usdc.id, &(10 * STROOPS), &3u32); // +20

    let xlm_lb = h.vault.get_leaderboard(&h.xlm.id);
    assert_eq!(xlm_lb.len(), 1);
    assert_eq!(xlm_lb.get(0).unwrap().player, alice);

    let usdc_lb = h.vault.get_leaderboard(&h.usdc.id);
    assert_eq!(usdc_lb.len(), 1);
    assert_eq!(usdc_lb.get(0).unwrap().player, bob);
}

// ------------------------------ single-asset behaviors (XLM) ------------------------------

#[test]
fn resolve_win_3_guesses_pays_2x_bonus() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    let p = new_player(&h, 50 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    let bonus = h.vault.resolve_win(&p, &h.xlm.id, &(10 * STROOPS), &3u32);
    assert_eq!(bonus, 20 * STROOPS);
}

#[test]
fn resolve_win_5_guesses_pays_1_5x() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    let p = new_player(&h, 50 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    assert_eq!(h.vault.resolve_win(&p, &h.xlm.id, &(10 * STROOPS), &5u32), 15 * STROOPS);
}

#[test]
fn resolve_win_9_guesses_pays_0_75x() {
    let h = setup();
    fund(&h.xlm, &h.admin, 400 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(400 * STROOPS));
    let p = new_player(&h, 50 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    assert_eq!(h.vault.resolve_win(&p, &h.xlm.id, &(10 * STROOPS), &9u32), 75_000_000);
}

#[test]
fn resolve_loss_updates_unified_stats() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    let p = new_player(&h, 50 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    h.vault.resolve_loss(&p);
    assert_eq!(h.vault.get_pool_balance(&h.xlm.id), 110 * STROOPS);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.losses, 1);
    assert_eq!(s.current_streak, 0);
    assert_eq!(s.games_played, 1);
}

#[test]
fn streak_resets_on_loss_unified() {
    let h = setup();
    fund(&h.xlm, &h.admin, 1_000 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(1_000 * STROOPS));
    let p = new_player(&h, 1_000 * STROOPS);
    for _ in 0..2 {
        h.vault.stake(&p, &h.xlm.id, &(1 * STROOPS));
        h.vault.resolve_win(&p, &h.xlm.id, &(1 * STROOPS), &3u32);
    }
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.best_streak, 2);
    h.vault.stake(&p, &h.xlm.id, &(1 * STROOPS));
    h.vault.resolve_loss(&p);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.current_streak, 0);
    assert_eq!(s.best_streak, 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // DailyCapReached
fn daily_cap_reached_panics() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    let p = new_player(&h, 1_000 * STROOPS);

    h.vault.stake(&p, &h.xlm.id, &(20 * STROOPS));
    let got = h.vault.resolve_win(&p, &h.xlm.id, &(20 * STROOPS), &3u32);
    assert_eq!(got, 30 * STROOPS);
    // Second win exceeds remaining cap
    h.vault.stake(&p, &h.xlm.id, &(20 * STROOPS));
    h.vault.resolve_win(&p, &h.xlm.id, &(20 * STROOPS), &3u32);
}

#[test]
fn daily_cap_rolls_after_24h() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    let p = new_player(&h, 1_000 * STROOPS);

    h.vault.stake(&p, &h.xlm.id, &(20 * STROOPS));
    let _ = h.vault.resolve_win(&p, &h.xlm.id, &(20 * STROOPS), &3u32);

    // Jump past both the 24h window and the temp-storage TTL.
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

    h.vault.stake(&p, &h.xlm.id, &(1 * STROOPS));
    let _ = h.vault.resolve_win(&p, &h.xlm.id, &(1 * STROOPS), &3u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // InsufficientPool
fn insufficient_pool_panics() {
    let h = setup();
    fund(&h.xlm, &h.admin, 1 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(1 * STROOPS));
    let p = new_player(&h, 1_000 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(100 * STROOPS));
    h.vault.resolve_win(&p, &h.xlm.id, &(100 * STROOPS), &3u32);
}

#[test]
fn daily_remaining_reflects_winnings() {
    let h = setup();
    fund(&h.xlm, &h.admin, 400 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(400 * STROOPS));
    let p = new_player(&h, 1_000 * STROOPS);
    assert_eq!(h.vault.get_daily_remaining(&p, &h.xlm.id), 100 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(10 * STROOPS));
    h.vault.resolve_win(&p, &h.xlm.id, &(10 * STROOPS), &3u32); // bonus 20
    // Pool after = 400 + 10 - 10 - 20 = 380. Cap = 95. Won = 20 → 75.
    assert_eq!(h.vault.get_daily_remaining(&p, &h.xlm.id), 75 * STROOPS);
}

// ------------------------------ input guards ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // InvalidStake
fn zero_stake_panics() {
    let h = setup();
    let p = new_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")] // InvalidGuessCount
fn zero_guesses_panics() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100 * STROOPS));
    let p = new_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &(1 * STROOPS));
    h.vault.resolve_win(&p, &h.xlm.id, &(1 * STROOPS), &0u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // InvalidStake (negative)
fn negative_stake_panics() {
    let h = setup();
    let p = new_player(&h, 10 * STROOPS);
    h.vault.stake(&p, &h.xlm.id, &-5);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // InvalidAmount
fn zero_admin_deposit_panics() {
    let h = setup();
    h.vault.admin_deposit(&h.xlm.id, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // InvalidAmount
fn negative_admin_deposit_panics() {
    let h = setup();
    h.vault.admin_deposit(&h.xlm.id, &-1);
}

// ------------------------------ uninitialized paths ------------------------------

fn setup_uninit<'a>() -> (Env, CrackdVaultClient<'a>, Asset<'a>) {
    let env = Env::default();
    env.mock_all_auths();
    let asset = register_asset(&env);
    let vault_id = env.register(CrackdVault, ());
    let vault = CrackdVaultClient::new(&env, &vault_id);
    (env, vault, asset)
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn stake_before_init_panics() {
    let (env, vault, asset) = setup_uninit();
    let p = Address::generate(&env);
    asset.admin.mint(&p, &(10 * STROOPS));
    vault.stake(&p, &asset.id, &(1 * STROOPS));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn get_admin_before_init_panics() {
    let (_, vault, _) = setup_uninit();
    let _ = vault.get_admin();
}

// ------------------------------ leaderboard cap / stats ------------------------------

#[test]
fn leaderboard_caps_at_10_entries() {
    let h = setup();
    fund(&h.xlm, &h.admin, 100_000 * STROOPS);
    h.vault.admin_deposit(&h.xlm.id, &(100_000 * STROOPS));

    for i in 0..15u32 {
        let p = new_player(&h, 100 * STROOPS);
        let stake = ((i + 1) as i128) * STROOPS;
        h.vault.stake(&p, &h.xlm.id, &stake);
        h.vault.resolve_win(&p, &h.xlm.id, &stake, &7u32); // 1.0x
    }
    let lb = h.vault.get_leaderboard(&h.xlm.id);
    assert_eq!(lb.len(), 10);
    assert_eq!(lb.get(0).unwrap().total_earned, 15 * STROOPS);
    assert_eq!(lb.get(9).unwrap().total_earned, 6 * STROOPS);
}

#[test]
fn stats_for_unknown_player_are_zeroes() {
    let h = setup();
    let p = Address::generate(&h.env);
    let s = h.vault.get_player_stats(&p);
    assert_eq!(s.wins, 0);
    assert_eq!(s.losses, 0);
    assert_eq!(s.games_played, 0);
    let earnings = h.vault.get_player_earnings(&p);
    assert_eq!(earnings.len(), 0);
}
