/**
 * Game state persistence in Redis.
 *
 * - `game:{gameId}` → JSON-serialised GameState (TTL'd).
 * - `player:{walletAddress}:active` → gameId that this wallet is currently
 *   in (for reconnect flows).
 * - `vault:{gameId}` → AI's secret code in vs-ai modes. Held separately
 *   so it never accidentally ends up in the sanitised GameState blob we
 *   send to clients.
 */
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import type { GameState } from "../types/game.js";

export class GameStateStore {
  constructor(
    private readonly redis: Redis,
    private readonly cfg: AppConfig,
  ) {}

  private key(gameId: string): string {
    return `game:${gameId}`;
  }
  private vaultKey(gameId: string): string {
    return `vault:${gameId}`;
  }
  private activeKey(wallet: string): string {
    return `player:${wallet}:active`;
  }

  async save(state: GameState): Promise<void> {
    state.updatedAt = Date.now();
    await this.redis.set(
      this.key(state.gameId),
      JSON.stringify(state),
      "EX",
      this.cfg.GAME_SESSION_TTL_SECONDS,
    );
  }

  async load(gameId: string): Promise<GameState | null> {
    const raw = await this.redis.get(this.key(gameId));
    return raw ? (JSON.parse(raw) as GameState) : null;
  }

  async delete(gameId: string): Promise<void> {
    await this.redis.del(this.key(gameId), this.vaultKey(gameId));
  }

  async setVaultCode(gameId: string, code: string): Promise<void> {
    await this.redis.set(
      this.vaultKey(gameId),
      code,
      "EX",
      this.cfg.GAME_SESSION_TTL_SECONDS,
    );
  }

  async getVaultCode(gameId: string): Promise<string | null> {
    return await this.redis.get(this.vaultKey(gameId));
  }

  async setActiveGame(walletAddress: string, gameId: string): Promise<void> {
    await this.redis.set(
      this.activeKey(walletAddress),
      gameId,
      "EX",
      this.cfg.GAME_SESSION_TTL_SECONDS,
    );
  }

  async getActiveGame(walletAddress: string): Promise<string | null> {
    return await this.redis.get(this.activeKey(walletAddress));
  }

  async clearActiveGame(walletAddress: string): Promise<void> {
    await this.redis.del(this.activeKey(walletAddress));
  }

  /**
   * Monotonic u32 session-id minter for Stellar Game Studio Hub calls.
   * Wraps back to 1 if it ever exceeds u32::MAX — extremely unlikely but
   * keeps the value in range.
   */
  /**
   * Store the short invite → full gameId mapping so joiners can paste
   * just the 6-character code. TTL matches the game session so stale
   * invites disappear on their own.
   */
  async bindInvite(inviteCode: string, gameId: string): Promise<void> {
    await this.redis.set(
      `invite:${inviteCode.toUpperCase()}`,
      gameId,
      "EX",
      this.cfg.GAME_SESSION_TTL_SECONDS,
    );
  }

  async resolveInvite(inviteCode: string): Promise<string | null> {
    return await this.redis.get(`invite:${inviteCode.toUpperCase()}`);
  }

  // ---- All-players leaderboard (backend-tracked, all modes) ----

  async recordGameResult(wallet: string, won: boolean): Promise<void> {
    if (!wallet || wallet === "vault") return;
    await this.redis.zincrby("lb:games", 1, wallet);
    if (won) {
      await this.redis.zincrby("lb:wins", 1, wallet);
    } else {
      await this.redis.zincrby("lb:losses", 1, wallet);
    }
  }

  async getAllPlayersLeaderboard(
    limit = 20,
  ): Promise<Array<{ wallet: string; wins: number; losses: number; games: number }>> {
    const wallets = await this.redis.zrevrangebyscore(
      "lb:games",
      "+inf",
      "1",
      "LIMIT",
      0,
      limit,
    );
    const result: Array<{ wallet: string; wins: number; losses: number; games: number }> = [];
    for (const wallet of wallets) {
      const wins = Number(await this.redis.zscore("lb:wins", wallet)) || 0;
      const losses = Number(await this.redis.zscore("lb:losses", wallet)) || 0;
      const games = Number(await this.redis.zscore("lb:games", wallet)) || 0;
      result.push({ wallet, wins, losses, games });
    }
    // Sort by wins desc, then by fewer losses
    result.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    return result;
  }

  async nextHubSessionId(): Promise<number> {
    const n = await this.redis.incr("crackd:hub:session_seq");
    const MAX_U32 = 0xffff_ffff;
    if (n > MAX_U32) {
      await this.redis.set("crackd:hub:session_seq", 1);
      return 1;
    }
    return n;
  }
}
