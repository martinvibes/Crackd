//! Duel events — token included in all relevant payloads.
#![allow(deprecated)]

use soroban_sdk::{symbol_short, Address, BytesN, Env, IntoVal, Symbol, Val, Vec};

const DOMAIN: Symbol = symbol_short!("crackd");
const TOPIC_DUEL: Symbol = symbol_short!("duel");

fn emit<D: IntoVal<Env, Val>>(env: &Env, action: Symbol, data: D) {
    env.events().publish((DOMAIN, TOPIC_DUEL, action), data);
}

pub fn created(
    env: &Env,
    game_id: &BytesN<32>,
    player_one: &Address,
    token: &Address,
    stake: i128,
) {
    emit(
        env,
        symbol_short!("created"),
        (game_id.clone(), player_one.clone(), token.clone(), stake),
    );
}

pub fn joined(env: &Env, game_id: &BytesN<32>, player_two: &Address) {
    emit(env, symbol_short!("joined"), (game_id.clone(), player_two.clone()));
}

pub fn winner(
    env: &Env,
    game_id: &BytesN<32>,
    token: &Address,
    winner: &Address,
    payout: i128,
    fee: i128,
) {
    let mut data: Vec<Val> = Vec::new(env);
    data.push_back(game_id.into_val(env));
    data.push_back(token.into_val(env));
    data.push_back(winner.into_val(env));
    data.push_back(payout.into_val(env));
    data.push_back(fee.into_val(env));
    emit(env, symbol_short!("winner"), data);
}

pub fn draw(env: &Env, game_id: &BytesN<32>) {
    emit(env, symbol_short!("draw"), (game_id.clone(),));
}

pub fn cancelled(env: &Env, game_id: &BytesN<32>) {
    emit(env, symbol_short!("cancelled"), (game_id.clone(),));
}

pub fn expired(env: &Env, game_id: &BytesN<32>) {
    emit(env, symbol_short!("expired"), (game_id.clone(),));
}
