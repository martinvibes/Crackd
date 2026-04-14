#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient as TokenAdminClient},
    Address, BytesN, Env,
};

use crate::{CrackdDuel, CrackdDuelClient, GAME_TIMEOUT_SECS, MIN_STAKE};
use crate::types::GameStatus;

const STROOPS: i128 = 10_000_000;

struct Harness<'a> {
    env: Env,
    admin: Address,
    token_id: Address,
    token_admin: TokenAdminClient<'a>,
    token: TokenClient<'a>,
    duel: CrackdDuelClient<'a>,
    duel_id: Address,
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
    let duel_id = env.register(CrackdDuel, ());
    let duel = CrackdDuelClient::new(&env, &duel_id);
    duel.initialize(&admin, &token_id);

    Harness { env, admin, token_id, token_admin, token, duel, duel_id }
}

fn player(h: &Harness, amount: i128) -> Address {
    let p = Address::generate(&h.env);
    h.token_admin.mint(&p, &amount);
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
fn initialize_sets_state() {
    let h = setup();
    assert_eq!(h.duel.get_admin(), h.admin);
    assert_eq!(h.duel.get_token(), h.token_id);
    assert_eq!(h.duel.get_treasury_balance(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // AlreadyInitialized
fn reinit_panics() {
    let h = setup();
    h.duel.initialize(&h.admin, &h.token_id);
}

// ------------------------------ create ------------------------------

#[test]
fn create_game_locks_stake() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(5 * STROOPS));

    assert_eq!(h.token.balance(&p1), 5 * STROOPS);
    assert_eq!(h.token.balance(&h.duel_id), 5 * STROOPS);

    let g = h.duel.get_game(&id);
    assert_eq!(g.player_one, p1);
    assert_eq!(g.player_two, None);
    assert_eq!(g.stake_amount, 5 * STROOPS);
    assert_eq!(g.status, GameStatus::Waiting);
    assert_eq!(g.winner, None);

    let hist = h.duel.get_player_games(&p1);
    assert_eq!(hist.len(), 1);
    assert_eq!(hist.get(0).unwrap(), id);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")] // BelowMinimumStake
fn below_min_stake_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    h.duel.create_game(&p1, &(MIN_STAKE - 1));
}

// ------------------------------ join ------------------------------

#[test]
fn join_game_matches_stake() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);

    let g = h.duel.get_game(&id);
    assert_eq!(g.player_two.unwrap(), p2);
    assert_eq!(g.status, GameStatus::Active);
    assert_eq!(h.token.balance(&h.duel_id), 6 * STROOPS);

    let hist = h.duel.get_player_games(&p2);
    assert_eq!(hist.len(), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // SamePlayer
fn join_same_player_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p1, &id);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // GameNotFound
fn join_nonexistent_game_panics() {
    let h = setup();
    let p = player(&h, 10 * STROOPS);
    let fake_id = BytesN::from_array(&h.env, &[9u8; 32]);
    h.duel.join_game(&p, &fake_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // GameNotWaiting
fn join_twice_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let p3 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    // Second join should fail — game is Active now.
    h.duel.join_game(&p3, &id);
}

// ------------------------------ declare winner ------------------------------

#[test]
fn declare_winner_pays_and_fees() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let stake = 5 * STROOPS;
    let id = h.duel.create_game(&p1, &stake);
    h.duel.join_game(&p2, &id);

    h.duel.declare_winner(&id, &p1);

    // Pot = 10 XLM, fee = 2.5% = 0.25 XLM = 2_500_000 stroops, payout = 9.75 XLM
    let expected_fee = (10 * STROOPS) * 250 / 10_000;
    let expected_payout = 10 * STROOPS - expected_fee;
    assert_eq!(h.duel.get_treasury_balance(), expected_fee);
    assert_eq!(h.token.balance(&p1), 5 * STROOPS + expected_payout); // had 5 left after stake

    let g = h.duel.get_game(&id);
    assert_eq!(g.status, GameStatus::Completed);
    assert_eq!(g.winner.unwrap(), p1);
    assert_eq!(g.payout.unwrap(), expected_payout);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // InvalidWinner
fn declare_winner_outside_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let stranger = Address::generate(&h.env);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &stranger);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // GameNotActive
fn declare_winner_before_join_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.declare_winner(&id, &p1);
}

// ------------------------------ draw ------------------------------

#[test]
fn declare_draw_refunds_both() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let stake = 4 * STROOPS;
    let id = h.duel.create_game(&p1, &stake);
    h.duel.join_game(&p2, &id);

    h.duel.declare_draw(&id);

    assert_eq!(h.token.balance(&p1), 10 * STROOPS);
    assert_eq!(h.token.balance(&p2), 10 * STROOPS);
    assert_eq!(h.duel.get_treasury_balance(), 0);
    let g = h.duel.get_game(&id);
    assert_eq!(g.status, GameStatus::Refunded);
}

// ------------------------------ cancel ------------------------------

#[test]
fn cancel_game_by_player_one() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.cancel_game(&p1, &id);
    assert_eq!(h.token.balance(&p1), 10 * STROOPS);
    let g = h.duel.get_game(&id);
    assert_eq!(g.status, GameStatus::Refunded);
}

#[test]
fn cancel_game_by_admin() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.cancel_game(&h.admin, &id);
    assert_eq!(h.token.balance(&p1), 10 * STROOPS);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // Unauthorized
fn cancel_by_stranger_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let stranger = Address::generate(&h.env);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.cancel_game(&stranger, &id);
}

// ------------------------------ expire ------------------------------

#[test]
fn expire_game_after_timeout() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));

    jump_ledger(&h.env, GAME_TIMEOUT_SECS + 1, 1000);

    // Anyone can expire — use a random caller
    h.duel.expire_game(&id);
    assert_eq!(h.token.balance(&p1), 10 * STROOPS);
    let g = h.duel.get_game(&id);
    assert_eq!(g.status, GameStatus::Expired);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")] // NotTimedOutYet
fn expire_before_timeout_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    // Barely before timeout
    jump_ledger(&h.env, GAME_TIMEOUT_SECS - 1, 100);
    h.duel.expire_game(&id);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")] // GameExpired
fn join_after_timeout_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    jump_ledger(&h.env, GAME_TIMEOUT_SECS + 1, 1000);
    h.duel.join_game(&p2, &id);
}

// ------------------------------ treasury ------------------------------

#[test]
fn withdraw_treasury_moves_fees_out() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(5 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p1);

    let fee = h.duel.get_treasury_balance();
    assert!(fee > 0);

    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&fee, &sink);
    assert_eq!(h.token.balance(&sink), fee);
    assert_eq!(h.duel.get_treasury_balance(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidAmount (over-withdraw)
fn over_withdraw_treasury_panics() {
    let h = setup();
    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&1, &sink);
}

// ------------------------------ multiple games ------------------------------

#[test]
fn same_player_can_run_multiple_games() {
    let h = setup();
    let p1 = player(&h, 50 * STROOPS);
    let id1 = h.duel.create_game(&p1, &(3 * STROOPS));
    jump_ledger(&h.env, 1, 1);
    let id2 = h.duel.create_game(&p1, &(3 * STROOPS));
    assert!(id1 != id2);
    let hist = h.duel.get_player_games(&p1);
    assert_eq!(hist.len(), 2);
}

// =====================================================================
// Edge cases
// =====================================================================

// ------------------------------ uninitialized paths ------------------------------

fn setup_uninit<'a>() -> (Env, CrackdDuelClient<'a>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let sac_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let token_id = sac.address();
    let duel_id = env.register(CrackdDuel, ());
    let duel = CrackdDuelClient::new(&env, &duel_id);
    (env, duel, token_id)
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn create_before_init_panics() {
    let (env, duel, _) = setup_uninit();
    let p = Address::generate(&env);
    duel.create_game(&p, &(5 * STROOPS));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn join_before_init_panics() {
    let (env, duel, _) = setup_uninit();
    let p = Address::generate(&env);
    let fake = BytesN::from_array(&env, &[1u8; 32]);
    duel.join_game(&p, &fake);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn cancel_before_init_panics() {
    let (env, duel, _) = setup_uninit();
    let p = Address::generate(&env);
    let fake = BytesN::from_array(&env, &[1u8; 32]);
    duel.cancel_game(&p, &fake);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn expire_before_init_panics() {
    let (env, duel, _) = setup_uninit();
    let fake = BytesN::from_array(&env, &[1u8; 32]);
    duel.expire_game(&fake);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // NotInitialized
fn get_admin_before_init_panics() {
    let (_, duel, _) = setup_uninit();
    duel.get_admin();
}

// ------------------------------ state-machine enforcement ------------------------------

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // GameNotWaiting (cancel after join)
fn cancel_after_join_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.cancel_game(&p1, &id); // status Active now
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // GameNotWaiting (expire on active)
fn expire_active_game_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    jump_ledger(&h.env, GAME_TIMEOUT_SECS + 1, 1000);
    h.duel.expire_game(&id);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // GameNotActive (declare winner twice)
fn declare_winner_twice_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p1);
    h.duel.declare_winner(&id, &p1); // status Completed now
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // GameNotActive
fn declare_draw_after_winner_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p1);
    h.duel.declare_draw(&id);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // GameNotWaiting (cancel cancelled)
fn cancel_cancelled_game_panics() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    h.duel.cancel_game(&p1, &id);
    h.duel.cancel_game(&p1, &id); // Refunded, not Waiting
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // GameNotFound
fn get_nonexistent_game_panics() {
    let h = setup();
    let fake = BytesN::from_array(&h.env, &[9u8; 32]);
    h.duel.get_game(&fake);
}

// ------------------------------ player-history edge cases ------------------------------

#[test]
fn player_with_no_games_returns_empty_history() {
    let h = setup();
    let p = Address::generate(&h.env);
    let games = h.duel.get_player_games(&p);
    assert_eq!(games.len(), 0);
}

#[test]
fn expired_game_stays_in_history() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    jump_ledger(&h.env, GAME_TIMEOUT_SECS + 1, 1000);
    h.duel.expire_game(&id);

    let hist = h.duel.get_player_games(&p1);
    assert_eq!(hist.len(), 1);
    let g = h.duel.get_game(&id);
    assert_eq!(g.status, GameStatus::Expired);
}

// ------------------------------ exact-stake boundary ------------------------------

#[test]
fn create_with_exactly_min_stake_ok() {
    let h = setup();
    let p = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p, &MIN_STAKE);
    let g = h.duel.get_game(&id);
    assert_eq!(g.stake_amount, MIN_STAKE);
}

// ------------------------------ fee rounding ------------------------------

#[test]
fn fee_rounds_down_on_odd_stakes() {
    // stake = 1 XLM (10_000_000 stroops) → pot = 20_000_000, fee = 500_000.
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &MIN_STAKE);
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p2);

    let fee = h.duel.get_treasury_balance();
    let expected = 2 * MIN_STAKE * 250 / 10_000;
    assert_eq!(fee, expected);
    // Winner received pot - fee
    let payout = 2 * MIN_STAKE - expected;
    assert_eq!(h.token.balance(&p2), (10 * STROOPS) - MIN_STAKE + payout);
}

// ------------------------------ treasury partial withdraws ------------------------------

#[test]
fn treasury_partial_withdraws_accumulate_and_reduce() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let p2 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(5 * STROOPS));
    h.duel.join_game(&p2, &id);
    h.duel.declare_winner(&id, &p1);

    let start = h.duel.get_treasury_balance();
    assert!(start > 0);

    let sink = Address::generate(&h.env);
    let half = start / 2;
    h.duel.withdraw_treasury(&half, &sink);
    assert_eq!(h.duel.get_treasury_balance(), start - half);
    assert_eq!(h.token.balance(&sink), half);

    // Second partial withdraw the remainder
    h.duel.withdraw_treasury(&(start - half), &sink);
    assert_eq!(h.duel.get_treasury_balance(), 0);
    assert_eq!(h.token.balance(&sink), start);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidAmount
fn withdraw_zero_treasury_panics() {
    let h = setup();
    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&0, &sink);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidAmount
fn withdraw_negative_treasury_panics() {
    let h = setup();
    let sink = Address::generate(&h.env);
    h.duel.withdraw_treasury(&-5, &sink);
}

// ------------------------------ multiple concurrent games ------------------------------

#[test]
fn two_games_settle_independently() {
    let h = setup();
    let p1 = player(&h, 20 * STROOPS);
    let p2 = player(&h, 20 * STROOPS);
    let p3 = player(&h, 20 * STROOPS);

    let a = h.duel.create_game(&p1, &(5 * STROOPS));
    jump_ledger(&h.env, 1, 1);
    let b = h.duel.create_game(&p2, &(5 * STROOPS));
    h.duel.join_game(&p3, &a);
    h.duel.join_game(&p1, &b);

    h.duel.declare_winner(&a, &p3);
    h.duel.declare_draw(&b);

    let ga = h.duel.get_game(&a);
    let gb = h.duel.get_game(&b);
    assert_eq!(ga.status, GameStatus::Completed);
    assert_eq!(gb.status, GameStatus::Refunded);
    assert_eq!(ga.winner.unwrap(), p3);
    assert_eq!(gb.winner, None);
}

// ------------------------------ waiting game visible in history ------------------------------

#[test]
fn waiting_game_recorded_immediately_for_player_one() {
    let h = setup();
    let p1 = player(&h, 10 * STROOPS);
    let id = h.duel.create_game(&p1, &(3 * STROOPS));
    let hist = h.duel.get_player_games(&p1);
    assert_eq!(hist.len(), 1);
    assert_eq!(hist.get(0).unwrap(), id);
    // Player two history empty until join
}
