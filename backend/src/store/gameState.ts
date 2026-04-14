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
}
