#![no_std]
//! CrackdDuel — multi-asset PvP escrow for 1v1 staked matches.
//!
//! Each duel carries its own asset, picked at `create_game` time. Player
//! two must match the asset on join (enforced by reading it from the
//! stored GameSession — not a parameter, so mismatches are impossible).
//!
//! Same state machine as before: Waiting → Active → Completed/Refunded/Expired.

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, panic_with_error, token, xdr::ToXdr, Address, Bytes, BytesN, Env, Vec,
};

use errors::DuelError;
use types::{GameSession, GameStatus};

/// 1 XLM / 1 USDC (both 7-decimal) minimum stake.
pub const MIN_STAKE: i128 = 10_000_000;
pub const PROTOCOL_FEE_BPS: i128 = 250;
const BPS_DENOM: i128 = 10_000;
pub const GAME_TIMEOUT_SECS: u64 = 3600;

#[contract]
pub struct CrackdDuel;

#[contractimpl]
impl CrackdDuel {
    // ---------- Admin lifecycle ----------

    pub fn initialize(env: Env, admin: Address) {
        if storage::get_admin(&env).is_some() {
            panic_with_error!(&env, DuelError::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::bump_instance(&env);
    }

    // ---------- Player actions ----------

    /// Player one creates a game with a chosen asset + stake. Returns
    /// the unique game id (share with opponent).
    pub fn create_game(
        env: Env,
        player_one: Address,
        token: Address,
        stake: i128,
    ) -> BytesN<32> {
        require_initialized(&env);
        if stake < MIN_STAKE {
            panic_with_error!(&env, DuelError::BelowMinimumStake);
        }
        player_one.require_auth();

        token::Client::new(&env, &token).transfer(
            &player_one,
            &env.current_contract_address(),
            &stake,
        );

        let game_id = generate_game_id(&env, &player_one);
        let game = GameSession {
            game_id: game_id.clone(),
            player_one: player_one.clone(),
            player_two: None,
            token: token.clone(),
            stake_amount: stake,
            status: GameStatus::Waiting,
            created_at: env.ledger().timestamp(),
            winner: None,
            payout: None,
        };
        storage::set_game(&env, &game_id, &game);
        storage::append_player_game(&env, &player_one, &game_id);
        storage::bump_instance(&env);

        events::created(&env, &game_id, &player_one, &token, stake);
        game_id
    }

    /// Player two joins by matching the stored stake. Asset is fixed
    /// by create_game — no chance of mismatch.
    pub fn join_game(env: Env, player_two: Address, game_id: BytesN<32>) {
        require_initialized(&env);
        player_two.require_auth();

        let mut game = storage::get_game(&env, &game_id)
            .unwrap_or_else(|| panic_with_error!(&env, DuelError::GameNotFound));
        if game.status != GameStatus::Waiting {
            panic_with_error!(&env, DuelError::GameNotWaiting);
        }
        if player_two == game.player_one {
            panic_with_error!(&env, DuelError::SamePlayer);
        }
        if env.ledger().timestamp() > game.created_at + GAME_TIMEOUT_SECS {
            panic_with_error!(&env, DuelError::GameExpired);
        }

        token::Client::new(&env, &game.token).transfer(
            &player_two,
            &env.current_contract_address(),
            &game.stake_amount,
        );

        game.player_two = Some(player_two.clone());
        game.status = GameStatus::Active;
        storage::set_game(&env, &game_id, &game);
        storage::append_player_game(&env, &player_two, &game_id);
        storage::bump_instance(&env);

        events::joined(&env, &game_id, &player_two);
    }

    pub fn cancel_game(env: Env, caller: Address, game_id: BytesN<32>) {
        require_initialized(&env);
        caller.require_auth();

        let mut game = storage::get_game(&env, &game_id)
            .unwrap_or_else(|| panic_with_error!(&env, DuelError::GameNotFound));
        if game.status != GameStatus::Waiting {
            panic_with_error!(&env, DuelError::GameNotWaiting);
        }
        let admin = storage::get_admin(&env).unwrap();
        if caller != game.player_one && caller != admin {
            panic_with_error!(&env, DuelError::Unauthorized);
        }

        token::Client::new(&env, &game.token).transfer(
            &env.current_contract_address(),
            &game.player_one,
            &game.stake_amount,
        );
        game.status = GameStatus::Refunded;
        storage::set_game(&env, &game_id, &game);
        storage::bump_instance(&env);

        events::cancelled(&env, &game_id);
    }

    pub fn expire_game(env: Env, game_id: BytesN<32>) {
        require_initialized(&env);

        let mut game = storage::get_game(&env, &game_id)
            .unwrap_or_else(|| panic_with_error!(&env, DuelError::GameNotFound));
        if game.status != GameStatus::Waiting {
            panic_with_error!(&env, DuelError::GameNotWaiting);
        }
        if env.ledger().timestamp() <= game.created_at + GAME_TIMEOUT_SECS {
            panic_with_error!(&env, DuelError::NotTimedOutYet);
        }

        token::Client::new(&env, &game.token).transfer(
            &env.current_contract_address(),
            &game.player_one,
            &game.stake_amount,
        );
        game.status = GameStatus::Expired;
        storage::set_game(&env, &game_id, &game);
        storage::bump_instance(&env);

        events::expired(&env, &game_id);
    }

    // ---------- Admin resolution ----------

    pub fn declare_winner(env: Env, game_id: BytesN<32>, winner: Address) {
        require_admin(&env);

        let mut game = storage::get_game(&env, &game_id)
            .unwrap_or_else(|| panic_with_error!(&env, DuelError::GameNotFound));
        if game.status != GameStatus::Active {
            panic_with_error!(&env, DuelError::GameNotActive);
        }
        let p2 = game.player_two.clone().unwrap();
        if winner != game.player_one && winner != p2 {
            panic_with_error!(&env, DuelError::InvalidWinner);
        }

        let pot: i128 = game.stake_amount.saturating_mul(2);
        let fee: i128 = pot.saturating_mul(PROTOCOL_FEE_BPS) / BPS_DENOM;
        let payout: i128 = pot - fee;

        token::Client::new(&env, &game.token).transfer(
            &env.current_contract_address(),
            &winner,
            &payout,
        );
        let new_treasury = storage::get_treasury(&env, &game.token).saturating_add(fee);
        storage::set_treasury(&env, &game.token, new_treasury);

        let token_for_event = game.token.clone();
        game.status = GameStatus::Completed;
        game.winner = Some(winner.clone());
        game.payout = Some(payout);
        storage::set_game(&env, &game_id, &game);
        storage::bump_instance(&env);

        events::winner(&env, &game_id, &token_for_event, &winner, payout, fee);
    }

    pub fn declare_draw(env: Env, game_id: BytesN<32>) {
        require_admin(&env);

        let mut game = storage::get_game(&env, &game_id)
            .unwrap_or_else(|| panic_with_error!(&env, DuelError::GameNotFound));
        if game.status != GameStatus::Active {
            panic_with_error!(&env, DuelError::GameNotActive);
        }
        let p2 = game.player_two.clone().unwrap();

        let client = token::Client::new(&env, &game.token);
        client.transfer(
            &env.current_contract_address(),
            &game.player_one,
            &game.stake_amount,
        );
        client.transfer(&env.current_contract_address(), &p2, &game.stake_amount);

        game.status = GameStatus::Refunded;
        storage::set_game(&env, &game_id, &game);
        storage::bump_instance(&env);

        events::draw(&env, &game_id);
    }

    pub fn withdraw_treasury(env: Env, token: Address, amount: i128, recipient: Address) {
        if amount <= 0 {
            panic_with_error!(&env, DuelError::InvalidAmount);
        }
        require_admin(&env);
        let treasury = storage::get_treasury(&env, &token);
        if amount > treasury {
            panic_with_error!(&env, DuelError::InvalidAmount);
        }
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &recipient,
            &amount,
        );
        storage::set_treasury(&env, &token, treasury - amount);
        storage::bump_instance(&env);
    }

    // ---------- Public reads ----------

    pub fn get_game(env: Env, game_id: BytesN<32>) -> GameSession {
        storage::get_game(&env, &game_id)
            .unwrap_or_else(|| panic_with_error!(&env, DuelError::GameNotFound))
    }

    pub fn get_player_games(env: Env, player: Address) -> Vec<BytesN<32>> {
        storage::get_player_games(&env, &player)
    }

    pub fn get_treasury_balance(env: Env, token: Address) -> i128 {
        storage::get_treasury(&env, &token)
    }

    pub fn get_admin(env: Env) -> Address {
        require_initialized(&env);
        storage::get_admin(&env).unwrap()
    }
}

// ------------------------- helpers -------------------------

fn require_initialized(env: &Env) {
    if storage::get_admin(env).is_none() {
        panic_with_error!(env, DuelError::NotInitialized);
    }
}

fn require_admin(env: &Env) -> Address {
    let admin = match storage::get_admin(env) {
        Some(a) => a,
        None => panic_with_error!(env, DuelError::NotInitialized),
    };
    admin.require_auth();
    admin
}

fn generate_game_id(env: &Env, player_one: &Address) -> BytesN<32> {
    let mut data: Bytes = player_one.clone().to_xdr(env);
    data.extend_from_array(&env.ledger().timestamp().to_be_bytes());
    data.extend_from_array(&env.ledger().sequence().to_be_bytes());
    env.crypto().sha256(&data).into()
}
