/**
 * Typed REST client for the Crackd backend.
 *
 * Thin wrapper over fetch — just enough typing + error unification so
 * React Query can call one function per endpoint.
 */
const BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

// ---- response shapes mirrored from backend routes ----

export interface Asset {
  symbol: string;
  displayName: string;
  decimals: number;
  sac: string;
  isNative: boolean;
}

export interface PoolBalance {
  asset: string;
  displayName: string;
  balance: number;
  balanceStroops: string;
}

export interface LeaderboardRow {
  rank: number;
  player: string;
  username?: string | null;
  avatarUrl?: string | null;
  totalEarned: number;
  totalEarnedStroops: string;
  wins: number;
  bestStreak: number;
}

export interface PlayerStats {
  wallet: string;
  username: string | null;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  assets: {
    asset: string;
    displayName: string;
    totalEarned: number;
    totalEarnedStroops: string;
    dailyRemaining: number;
  }[];
}

// ---- fetcher ----

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${msg}`);
  }
  return (await res.json()) as T;
}

// ---- endpoints ----

export const api = {
  assets: () => j<{ assets: Asset[] }>("/api/assets"),
  poolBalances: () => j<{ balances: PoolBalance[]; lastUpdated: number }>("/api/pool-balances"),
  poolBalance: (asset: string) =>
    j<{ asset: string; balance: number; balanceStroops: string }>(
      `/api/pool-balance?asset=${asset}`,
    ),
  leaderboard: (asset: string) =>
    j<{ asset: string; leaderboard: LeaderboardRow[] }>(
      `/api/leaderboard?asset=${asset}`,
    ),
  player: (wallet: string) => j<PlayerStats>(`/api/player/${wallet}`),
  game: (gameId: string) => j<unknown>(`/api/game/${gameId}`),
  resolveInvite: (code: string) => j<{ gameId: string }>(`/api/invite/${code}`),
  setUsername: (wallet: string, username: string) =>
    j<{ ok: boolean; username: string }>(`/api/player/${wallet}/username`, {
      method: "PUT",
      body: JSON.stringify({ username }),
    }),
  setAvatar: (wallet: string, imageDataUrl: string) =>
    j<{ ok: boolean }>(`/api/player/${wallet}/avatar`, {
      method: "PUT",
      body: JSON.stringify({ image: imageDataUrl }),
    }),
  leaderboardAll: () =>
    j<{
      leaderboard: Array<{
        rank: number;
        player: string;
        wins: number;
        losses: number;
        gamesPlayed: number;
      }>;
    }>("/api/leaderboard/all"),
};

export { BASE as API_BASE };
