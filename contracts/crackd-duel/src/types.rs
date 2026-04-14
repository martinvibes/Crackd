use soroban_sdk::{contracttype, Address, BytesN, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Treasury balance per asset.
    TreasuryBalance(Address),
    Game(BytesN<32>),
    PlayerGames(Address),
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GameStatus {
    Waiting = 0,
    Active = 1,
    Completed = 2,
    Refunded = 3,
    Expired = 4,
}

/// A duel carries its own asset. Choosing the token is a per-game decision
/// made by player one at `create_game`; player two must match it on join.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameSession {
    pub game_id: BytesN<32>,
    pub player_one: Address,
    pub player_two: Option<Address>,
    pub token: Address,
    pub stake_amount: i128,
    pub status: GameStatus,
    pub created_at: u64,
    pub winner: Option<Address>,
    pub payout: Option<i128>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerGamesList {
    pub games: Vec<BytesN<32>>,
}
