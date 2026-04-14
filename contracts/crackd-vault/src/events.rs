//! Event topic helpers — backend indexer pattern-matches on these.
//!
//! We deliberately use explicit topic tuples (`crackd`, domain, action)
//! rather than `#[contractevent]` derived topics because the derived form
//! embeds the struct name which trips Soroban's symbol length cap at
//! deploy time for some of our event names.
#![allow(deprecated)]

use soroban_sdk::{symbol_short, Address, Env, IntoVal, Symbol, Val, Vec};

const DOMAIN: Symbol = symbol_short!("crackd");
const TOPIC_VAULT: Symbol = symbol_short!("vault");

fn emit<D: IntoVal<Env, Val>>(env: &Env, action: Symbol, data: D) {
    env.events().publish((DOMAIN, TOPIC_VAULT, action), data);
}

pub fn initialized(env: &Env, admin: &Address, initial_pool: i128) {
    emit(env, symbol_short!("init"), (admin.clone(), initial_pool));
}

pub fn staked(env: &Env, player: &Address, amount: i128, pool_after: i128) {
    emit(env, symbol_short!("stake"), (player.clone(), amount, pool_after));
}

pub fn loss(env: &Env, player: &Address) {
    emit(env, symbol_short!("loss"), (player.clone(),));
}

pub fn payout(
    env: &Env,
    player: &Address,
    stake: i128,
    bonus: i128,
    guesses_used: u32,
) {
    let mut data: Vec<Val> = Vec::new(env);
    data.push_back(player.into_val(env));
    data.push_back(stake.into_val(env));
    data.push_back(bonus.into_val(env));
    data.push_back(guesses_used.into_val(env));
    emit(env, symbol_short!("payout"), data);
}

pub fn topup(env: &Env, admin: &Address, amount: i128, pool_after: i128) {
    emit(env, symbol_short!("topup"), (admin.clone(), amount, pool_after));
}

pub fn daily_reset(env: &Env, timestamp: u64) {
    emit(env, symbol_short!("reset"), (timestamp,));
}
