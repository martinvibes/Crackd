use soroban_sdk::{contracttype, Address};

/// Storage keys for the vault contract.
///
/// Instance keys (Admin, Token, PoolBalance, LastResetTime, Leaderboard)
/// live with the contract and are always loaded cheaply.
/// PlayerStats is persistent (long-lived per-player history).
/// PlayerWinnings is temporary and expires with the 24-hour window,
/// so resets are automatic via TTL rather than a sweep loop.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    PoolBalance,
    LastResetTime,
    Leaderboard,
    PlayerStats(Address),
    PlayerWinnings(Address),
}

/// Per-player aggregate stats, surfaced by `get_player_stats`
/// and indirectly on the on-chain leaderboard.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerStats {
    pub wins: u32,
    pub losses: u32,
    pub total_earned: i128, // stroops
    pub best_streak: u32,
    pub current_streak: u32,
    pub games_played: u32,
}

impl PlayerStats {
    pub fn empty() -> Self {
        Self {
            wins: 0,
            losses: 0,
            total_earned: 0,
            best_streak: 0,
            current_streak: 0,
            games_played: 0,
        }
    }
}

/// Leaderboard row sent back by `get_leaderboard`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub player: Address,
    pub total_earned: i128,
    pub wins: u32,
    pub best_streak: u32,
}
