use soroban_sdk::contracterror;

/// Errors emitted by the CrackdVault contract.
///
/// Numeric codes are stable across deploys — clients match on them.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InsufficientPool = 4,
    DailyCapReached = 5,
    InvalidStake = 6,
    InvalidGuessCount = 7,
    InvalidAmount = 8,
}
