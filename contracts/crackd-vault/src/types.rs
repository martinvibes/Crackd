use soroban_sdk::{contracttype, Address};

/// Storage keys. All pool/cap/winnings entries are keyed by the asset
/// (token SAC `Address`) so the contract natively supports multi-asset
/// staking — XLM pool is independent of USDC pool, etc.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin (contract owner).
    Admin,
    /// Total prize pool per asset.
    PoolBalance(Address),
    /// Last-reset timestamp per asset for the daily-cap rollover.
    LastResetTime(Address),
    /// Winnings-in-current-day per (asset, player). Temporary TTL.
    PlayerWinnings(Address, Address),
    /// Unified gameplay stats per player — denomination-agnostic.
    PlayerStats(Address),
    /// Per-asset earnings per player: map(token → earned stroops).
    PlayerEarnings(Address),
    /// Per-asset leaderboard: vec<address> top-N by earnings in that asset.
    Leaderboard(Address),
}

/// Unified gameplay stats — wins/losses/streaks don't need an asset
/// denomination. Earnings are tracked per-asset via `PlayerEarnings`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerStats {
    pub wins: u32,
    pub losses: u32,
    pub best_streak: u32,
    pub current_streak: u32,
    pub games_played: u32,
}

impl PlayerStats {
    pub fn empty() -> Self {
        Self {
            wins: 0,
            losses: 0,
            best_streak: 0,
            current_streak: 0,
            games_played: 0,
        }
    }
}

/// Leaderboard row for a given asset.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub player: Address,
    pub total_earned: i128,
    pub wins: u32,
    pub best_streak: u32,
}
