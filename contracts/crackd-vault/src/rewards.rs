//! Pure reward + daily-cap math. No storage, no env — trivially unit-testable.

/// Reward multiplier (basis points) based on number of guesses used by the
/// winning player. 10_000 bps = 1.00× bonus.
///
/// Philosophy: every winner AT LEAST doubles their stake (1.0× bonus).
/// Fast crackers get a small extra bonus, but nobody is punished for
/// winning "slowly". Winning is winning.
///
/// Total payout = stake + (stake × multiplier / 10_000):
///   1–3 guesses → 1.50× bonus → 2.50× total
///   4–5         → 1.25× bonus → 2.25× total
///   6+          → 1.00× bonus → 2.00× total
pub fn multiplier_bps(guesses_used: u32) -> i128 {
    match guesses_used {
        0 => 0, // invalid — caller should reject before reaching here
        1..=3 => 15_000,
        4..=5 => 12_500,
        _ => 10_000,
    }
}

const BPS_DENOM: i128 = 10_000;

/// Payout before applying the 25% daily cap.
pub fn gross_payout(stake: i128, guesses_used: u32) -> i128 {
    stake.saturating_mul(multiplier_bps(guesses_used)) / BPS_DENOM
}

/// Apply the 25% pool daily cap on a per-player basis.
///
/// Returns the clamped payout and the new cumulative daily winnings.
/// If the player has already hit the cap, returns `None` → caller errors out.
pub fn apply_daily_cap(
    pool_balance: i128,
    already_won_today: i128,
    desired_payout: i128,
) -> Option<(i128, i128)> {
    let cap = pool_balance / 4;
    if already_won_today >= cap {
        return None;
    }
    let remaining = cap - already_won_today;
    let actual = desired_payout.min(remaining);
    if actual <= 0 {
        return None;
    }
    Some((actual, already_won_today + actual))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multiplier_tiers() {
        assert_eq!(multiplier_bps(1), 15_000);
        assert_eq!(multiplier_bps(3), 15_000);
        assert_eq!(multiplier_bps(4), 12_500);
        assert_eq!(multiplier_bps(5), 12_500);
        assert_eq!(multiplier_bps(6), 10_000);
        assert_eq!(multiplier_bps(7), 10_000);
        assert_eq!(multiplier_bps(8), 10_000);
        assert_eq!(multiplier_bps(100), 10_000);
    }

    #[test]
    fn gross_payout_math() {
        // 10 XLM stake, cracked in 3 → 1.5× bonus → 15 XLM
        assert_eq!(gross_payout(100_000_000, 3), 150_000_000);
        // 10 XLM stake, 5 guesses → 1.25× bonus → 12.5 XLM
        assert_eq!(gross_payout(100_000_000, 5), 125_000_000);
        // 10 XLM stake, 9 guesses → 1.0× bonus → 10 XLM
        assert_eq!(gross_payout(100_000_000, 9), 100_000_000);
    }

    #[test]
    fn daily_cap_clamps_payout() {
        // pool = 400, cap = 100. already won 60 → 40 remaining.
        // desired = 80 → clamped to 40.
        let (payout, total) = apply_daily_cap(400, 60, 80).unwrap();
        assert_eq!(payout, 40);
        assert_eq!(total, 100);
    }

    #[test]
    fn daily_cap_no_clamp_when_under() {
        // pool = 1000, cap = 250, won 0 → desired 50 passes through.
        let (payout, total) = apply_daily_cap(1000, 0, 50).unwrap();
        assert_eq!(payout, 50);
        assert_eq!(total, 50);
    }

    #[test]
    fn daily_cap_exhausted_returns_none() {
        // already_won == cap → no allowance left.
        assert!(apply_daily_cap(400, 100, 10).is_none());
    }
}
