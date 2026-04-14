use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DuelError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    GameNotFound = 4,
    GameNotWaiting = 5,
    GameNotActive = 6,
    StakeMismatch = 7,
    SamePlayer = 8,
    InvalidWinner = 9,
    GameExpired = 10,
    BelowMinimumStake = 11,
    InvalidAmount = 12,
    NotTimedOutYet = 13,
}
