//! Duel contract events. Same pattern as vault — 3-symbol topic tuple so
//! backend can filter by (crackd, duel, action).
#![allow(deprecated)]

use soroban_sdk::{symbol_short, Address, BytesN, Env, IntoVal, Symbol, Val};

const DOMAIN: Symbol = symbol_short!("crackd");
const TOPIC_DUEL: Symbol = symbol_short!("duel");

fn emit<D: IntoVal<Env, Val>>(env: &Env, action: Symbol, data: D) {
    env.events().publish((DOMAIN, TOPIC_DUEL, action), data);
}

pub fn created(env: &Env, game_id: &BytesN<32>, player_one: &Address, stake: i128) {
    emit(env, symbol_short!("created"), (game_id.clone(), player_one.clone(), stake));
}

pub fn joined(env: &Env, game_id: &BytesN<32>, player_two: &Address) {
    emit(env, symbol_short!("joined"), (game_id.clone(), player_two.clone()));
}

pub fn winner(
    env: &Env,
    game_id: &BytesN<32>,
    winner: &Address,
    payout: i128,
    fee: i128,
) {
    emit(
        env,
        symbol_short!("winner"),
        (game_id.clone(), winner.clone(), payout, fee),
    );
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
