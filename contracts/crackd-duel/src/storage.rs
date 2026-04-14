//! Typed storage wrappers, multi-asset.
use soroban_sdk::{Address, BytesN, Env, Vec};

use crate::types::{DataKey, GameSession};

const BUMP_LOW: u32 = 100_000;
const BUMP_HIGH: u32 = 518_400;

// -- Admin ------------------------------------------------------------------

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

// -- Treasury per asset -----------------------------------------------------

pub fn get_treasury(env: &Env, token: &Address) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TreasuryBalance(token.clone()))
        .unwrap_or(0)
}
pub fn set_treasury(env: &Env, token: &Address, amount: i128) {
    env.storage()
        .instance()
        .set(&DataKey::TreasuryBalance(token.clone()), &amount);
}

pub fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_LOW, BUMP_HIGH);
}

// -- Game sessions (persistent) --------------------------------------------

pub fn set_game(env: &Env, id: &BytesN<32>, game: &GameSession) {
    let key = DataKey::Game(id.clone());
    env.storage().persistent().set(&key, game);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_LOW, BUMP_HIGH);
}
pub fn get_game(env: &Env, id: &BytesN<32>) -> Option<GameSession> {
    let key = DataKey::Game(id.clone());
    env.storage().persistent().get(&key)
}

// -- Per-player game history (persistent) ---------------------------------

pub fn get_player_games(env: &Env, player: &Address) -> Vec<BytesN<32>> {
    let key = DataKey::PlayerGames(player.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}
pub fn append_player_game(env: &Env, player: &Address, id: &BytesN<32>) {
    let key = DataKey::PlayerGames(player.clone());
    let mut games = get_player_games(env, player);
    games.push_back(id.clone());
    env.storage().persistent().set(&key, &games);
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_LOW, BUMP_HIGH);
}
