use soroban_sdk::{contracttype, Address, BytesN, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    TreasuryBalance,
    Game(BytesN<32>),
    PlayerGames(Address),
}

/// Lifecycle of a duel. State-machine transitions are enforced by the
/// contract — see the function bodies in `game.rs`.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GameStatus {
    /// `create_game` called; waiting for a second player to join.
    Waiting = 0,
    /// Both players joined; game in progress off-chain.
    Active = 1,
    /// Admin declared a winner; payout transferred.
    Completed = 2,
    /// Admin declared a draw, or player one cancelled while Waiting;
    /// stakes refunded.
    Refunded = 3,
    /// No second player joined inside the timeout; player one's stake
    /// was refunded via `expire_game`.
    Expired = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameSession {
    pub game_id: BytesN<32>,
    pub player_one: Address,
    pub player_two: Option<Address>,
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
