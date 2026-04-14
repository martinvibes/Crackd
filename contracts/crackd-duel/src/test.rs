#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient as TokenAdminClient},
    Address, BytesN, Env,
};

use crate::types::GameStatus;
use crate::{CrackdDuel, CrackdDuelClient, GAME_TIMEOUT_SECS, MIN_STAKE};

const STROOPS: i128 = 10_000_000;

struct Asset<'a> {
    id: Address,
    admin: TokenAdminClient<'a>,
    client: TokenClient<'a>,
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

struct Harness<'a> {
    env: Env,
    admin: Address,
    xlm: Asset<'a>,
    usdc: Asset<'a>,
    duel: CrackdDuelClient<'a>,
    duel_id: Address,
}

fn setup<'a>() -> Harness<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let xlm = register_asset(&env);
    let usdc = register_asset(&env);
    let admin = Address::generate(&env);
    let duel_id = env.register(CrackdDuel, ());
    let duel = CrackdDuelClient::new(&env, &duel_id);
    duel.initialize(&admin);
    Harness { env, admin, xlm, usdc, duel, duel_id }
}

fn player_with(h: &Harness, xlm_amt: i128, usdc_amt: i128) -> Address {
    let p = Address::generate(&h.env);
    h.xlm.admin.mint(&p, &xlm_amt);
    h.usdc.admin.mint(&p, &usdc_amt);
    p
}

fn jump_ledger(env: &Env, extra_secs: u64, extra_seq: u32) {
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + extra_secs,
        protocol_version: env.ledger().protocol_version(),
        sequence_number: env.ledger().sequence() + extra_seq,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 4096,
        max_entry_ttl: 6_312_000,
    });
}

// ------------------------------ init ------------------------------

#[test]
fn initialize_sets_admin_only() {
    let h = setup();
    assert_eq!(h.duel.get_admin(), h.admin);
    assert_eq!(h.duel.get_treasury_balance(&h.xlm.id), 0);
    assert_eq!(h.duel.get_treasury_balance(&h.usdc.id), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // AlreadyInitialized
fn reinit_panics() {
    let h = setup();
    h.duel.initialize(&h.admin);
}

// ------------------------------ create + join ------------------------------

#[test]
fn create_game_in_xlm_locks_stake() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(5 * STROOPS));
    assert_eq!(h.xlm.client.balance(&p1), 5 * STROOPS);
    assert_eq!(h.xlm.client.balance(&h.duel_id), 5 * STROOPS);
    let g = h.duel.get_game(&id);
    assert_eq!(g.token, h.xlm.id);
    assert_eq!(g.stake_amount, 5 * STROOPS);
    assert_eq!(g.status, GameStatus::Waiting);
}

#[test]
fn create_game_in_usdc_locks_stake() {
    let h = setup();
    let p1 = player_with(&h, 0, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &h.usdc.id, &(5 * STROOPS));
    assert_eq!(h.usdc.client.balance(&p1), 5 * STROOPS);
    assert_eq!(h.usdc.client.balance(&h.duel_id), 5 * STROOPS);
    let g = h.duel.get_game(&id);
    assert_eq!(g.token, h.usdc.id);
}

#[test]
fn join_uses_same_asset_as_create() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let p2 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    assert_eq!(h.xlm.client.balance(&h.duel_id), 6 * STROOPS);
    // USDC never moved
    assert_eq!(h.usdc.client.balance(&h.duel_id), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")] // BelowMinimumStake
fn below_min_stake_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    h.duel.create_game(&p1, &h.xlm.id, &(MIN_STAKE - 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // SamePlayer
fn join_same_player_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.join_game(&p1, &id);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // GameNotWaiting (second join)
fn join_twice_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let p2 = player_with(&h, 10 * STROOPS, 0);
    let p3 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.join_game(&p3, &id);
}

// ------------------------------ resolution ------------------------------

#[test]
fn declare_winner_pays_winner_in_game_asset_only() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 10 * STROOPS);
    let p2 = player_with(&h, 10 * STROOPS, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(5 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p1);

    let expected_fee = (10 * STROOPS) * 250 / 10_000;
    let expected_payout = 10 * STROOPS - expected_fee;
    assert_eq!(h.duel.get_treasury_balance(&h.xlm.id), expected_fee);
    assert_eq!(h.duel.get_treasury_balance(&h.usdc.id), 0); // untouched
    assert_eq!(h.xlm.client.balance(&p1), 5 * STROOPS + expected_payout);
    // p1's USDC balance unchanged
    assert_eq!(h.usdc.client.balance(&p1), 10 * STROOPS);
}

#[test]
fn treasuries_accumulate_per_asset() {
    let h = setup();
    let p1 = player_with(&h, 50 * STROOPS, 50 * STROOPS);
    let p2 = player_with(&h, 50 * STROOPS, 50 * STROOPS);

    // XLM game
    let ida = h.duel.create_game(&p1, &h.xlm.id, &(10 * STROOPS));
    h.duel.join_game(&p2, &ida);
    h.duel.declare_winner(&ida, &p1);

    // USDC game
    jump_ledger(&h.env, 1, 1);
    let idb = h.duel.create_game(&p1, &h.usdc.id, &(10 * STROOPS));
    h.duel.join_game(&p2, &idb);
    h.duel.declare_winner(&idb, &p2);

    let xlm_fee = (20 * STROOPS) * 250 / 10_000;
    let usdc_fee = (20 * STROOPS) * 250 / 10_000;
    assert_eq!(h.duel.get_treasury_balance(&h.xlm.id), xlm_fee);
    assert_eq!(h.duel.get_treasury_balance(&h.usdc.id), usdc_fee);
}

#[test]
fn declare_draw_refunds_in_game_asset() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 10 * STROOPS);
    let p2 = player_with(&h, 10 * STROOPS, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &h.usdc.id, &(4 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_draw(&id);
    assert_eq!(h.usdc.client.balance(&p1), 10 * STROOPS);
    assert_eq!(h.usdc.client.balance(&p2), 10 * STROOPS);
    let g = h.duel.get_game(&id);
    assert_eq!(g.status, GameStatus::Refunded);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // InvalidWinner
fn declare_winner_outside_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let p2 = player_with(&h, 10 * STROOPS, 0);
    let stranger = Address::generate(&h.env);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &stranger);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // GameNotActive (before join)
fn declare_winner_before_join_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.declare_winner(&id, &p1);
}

// ------------------------------ cancel + expire ------------------------------

#[test]
fn cancel_game_by_player_one_refunds_in_asset() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.cancel_game(&p1, &id);
    assert_eq!(h.xlm.client.balance(&p1), 10 * STROOPS);
}

#[test]
fn cancel_game_by_admin_refunds() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.cancel_game(&h.admin, &id);
    assert_eq!(h.xlm.client.balance(&p1), 10 * STROOPS);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // Unauthorized
fn cancel_by_stranger_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let stranger = Address::generate(&h.env);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    h.duel.cancel_game(&stranger, &id);
}

#[test]
fn expire_game_after_timeout_refunds() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    jump_ledger(&h.env, GAME_TIMEOUT_SECS + 1, 1000);
    h.duel.expire_game(&id);
    assert_eq!(h.xlm.client.balance(&p1), 10 * STROOPS);
    assert_eq!(h.duel.get_game(&id).status, GameStatus::Expired);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")] // NotTimedOutYet
fn expire_before_timeout_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    jump_ledger(&h.env, GAME_TIMEOUT_SECS - 1, 100);
    h.duel.expire_game(&id);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")] // GameExpired
fn join_after_timeout_panics() {
    let h = setup();
    let p1 = player_with(&h, 10 * STROOPS, 0);
    let p2 = player_with(&h, 10 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    jump_ledger(&h.env, GAME_TIMEOUT_SECS + 1, 1000);
    h.duel.join_game(&p2, &id);
}

// ------------------------------ treasury ------------------------------

#[test]
fn withdraw_treasury_is_per_asset() {
    let h = setup();
    let p1 = player_with(&h, 50 * STROOPS, 0);
    let p2 = player_with(&h, 50 * STROOPS, 0);
    let id = h.duel.create_game(&p1, &h.xlm.id, &(10 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p1);
    let fee = h.duel.get_treasury_balance(&h.xlm.id);
    assert!(fee > 0);

    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&h.xlm.id, &fee, &sink);
    assert_eq!(h.duel.get_treasury_balance(&h.xlm.id), 0);
    assert_eq!(h.xlm.client.balance(&sink), fee);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidAmount (overdraw)
fn over_withdraw_treasury_panics() {
    let h = setup();
    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&h.xlm.id, &1, &sink);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidAmount
fn withdraw_zero_treasury_panics() {
    let h = setup();
    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&h.xlm.id, &0, &sink);
}

// ------------------------------ misc ------------------------------

#[test]
fn two_games_in_different_assets_settle_independently() {
    let h = setup();
    let p1 = player_with(&h, 20 * STROOPS, 20 * STROOPS);
    let p2 = player_with(&h, 20 * STROOPS, 20 * STROOPS);
    let a = h.duel.create_game(&p1, &h.xlm.id, &(5 * STROOPS));
    jump_ledger(&h.env, 1, 1);
    let b = h.duel.create_game(&p2, &h.usdc.id, &(5 * STROOPS));
    h.duel.join_game(&p2, &a);
    h.duel.join_game(&p1, &b);
    h.duel.declare_winner(&a, &p1);
    h.duel.declare_draw(&b);

    assert_eq!(h.duel.get_game(&a).status, GameStatus::Completed);
    assert_eq!(h.duel.get_game(&b).status, GameStatus::Refunded);
}

#[test]
fn same_player_can_run_multiple_games_in_same_asset() {
    let h = setup();
    let p1 = player_with(&h, 50 * STROOPS, 0);
    let id1 = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    jump_ledger(&h.env, 1, 1);
    let id2 = h.duel.create_game(&p1, &h.xlm.id, &(3 * STROOPS));
    assert!(id1 != id2);
    assert_eq!(h.duel.get_player_games(&p1).len(), 2);
}

#[test]
fn player_with_no_games_returns_empty_history() {
    let h = setup();
    let p = Address::generate(&h.env);
    assert_eq!(h.duel.get_player_games(&p).len(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // GameNotFound
fn get_nonexistent_game_panics() {
    let h = setup();
    let fake = BytesN::from_array(&h.env, &[9u8; 32]);
    h.duel.get_game(&fake);
}

// ------------------------------ uninitialized ------------------------------

fn setup_uninit<'a>() -> (Env, CrackdDuelClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();
    let duel_id = env.register(CrackdDuel, ());
    let duel = CrackdDuelClient::new(&env, &duel_id);
    (env, duel)
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn create_before_init_panics() {
    let (env, duel) = setup_uninit();
    let asset = register_asset(&env);
    let p = Address::generate(&env);
    asset.admin.mint(&p, &(100 * STROOPS));
    duel.create_game(&p, &asset.id, &(5 * STROOPS));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn get_admin_before_init_panics() {
    let (_, duel) = setup_uninit();
    duel.get_admin();
}
