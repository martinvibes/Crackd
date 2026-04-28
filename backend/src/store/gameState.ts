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

  // ---- Player identity (username) ----

  async setUsername(wallet: string, name: string): Promise<void> {
    await this.redis.set(`username:${wallet}`, name.slice(0, 20));
  }

  async getUsername(wallet: string): Promise<string | null> {
    return await this.redis.get(`username:${wallet}`);
  }

  async setAvatar(wallet: string, dataUrl: string): Promise<void> {
    // Cap at ~150KB to keep Redis happy.
    if (dataUrl.length > 200_000) throw new Error("Avatar too large");
    await this.redis.set(`avatar:${wallet}`, dataUrl);
  }

  async getAvatar(wallet: string): Promise<string | null> {
    return await this.redis.get(`avatar:${wallet}`);
  }

  async getUsernames(wallets: string[]): Promise<Record<string, string>> {
    if (wallets.length === 0) return {};
    const pipeline = this.redis.pipeline();
    for (const w of wallets) pipeline.get(`username:${w}`);
    const results = await pipeline.exec();
    const map: Record<string, string> = {};
    wallets.forEach((w, i) => {
      const val = results?.[i]?.[1] as string | null;
      if (val) map[w] = val;
    });
    return map;
  }

  /**
   * Batch-resolve identities for a list of wallets. Returns a map of
   * wallet → { username?, avatarUrl? } for leaderboard display.
   */
  async resolveIdentities(
    wallets: string[],
  ): Promise<Record<string, { username?: string; avatarUrl?: string }>> {
    if (wallets.length === 0) return {};
    const pipe = this.redis.pipeline();
    for (const w of wallets) {
      pipe.get(`username:${w}`);
      pipe.get(`avatar:${w}`);
    }
    const results = await pipe.exec();
    const map: Record<string, { username?: string; avatarUrl?: string }> = {};
    wallets.forEach((w, i) => {
      const username = results?.[i * 2]?.[1] as string | null;
      const avatarUrl = results?.[i * 2 + 1]?.[1] as string | null;
      map[w] = {
        ...(username ? { username } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
      };
    });
    return map;
  }

  // ---- PvP staked earnings (backend-tracked, mirrors vault layout) ----
  //
  // The CrackdDuel contract pays winners but doesn't keep a per-player
  // earnings ledger the way CrackdVault does. To keep the profile + per-
  // asset leaderboard honest, we mirror PvP wins into Redis ourselves,
  // keyed by SAC (matching the on-chain `getPlayerEarnings` map shape so
  // they can be merged additively without translation).
  //
  // Two stores:
  //  - HASH `pvp:earnings:{wallet}` — field=sac, value=stroops earned
  //  - ZSET `pvp:lb:{sac}`          — score=stroops earned, member=wallet
  //                                   (used for the per-asset leaderboard)

  async recordPvpEarnings(
    wallet: string,
    sac: string,
    stroops: bigint,
  ): Promise<void> {
    if (!wallet || wallet === "vault") return;
    if (stroops <= 0n) return;
    // Stroops fit in JS Number for any plausible stake (1 XLM = 1e7).
    // If we ever support multi-million-XLM stakes we'd need a Lua script
    // to add bigints — not worth the complexity until then.
    const n = Number(stroops);
    await Promise.all([
      this.redis.hincrby(`pvp:earnings:${wallet}`, sac, n),
      this.redis.zincrby(`pvp:lb:${sac}`, n, wallet),
    ]);
  }

  async getPvpEarnings(wallet: string): Promise<Record<string, bigint>> {
    const raw = await this.redis.hgetall(`pvp:earnings:${wallet}`);
    const out: Record<string, bigint> = {};
    for (const [sac, val] of Object.entries(raw)) {
      try {
        out[sac] = BigInt(val);
      } catch {
        // skip corrupt entries
      }
    }
    return out;
  }

  /**
   * Top earners for a given SAC, sorted by stroops earned (desc).
   * Returns wallet + earned-stroops pairs; caller pads with usernames.
   */
  async getPvpLeaderboard(
    sac: string,
    limit = 50,
  ): Promise<Array<{ wallet: string; earnedStroops: bigint }>> {
    const rows = await this.redis.zrevrange(
      `pvp:lb:${sac}`,
      0,
      limit - 1,
      "WITHSCORES",
    );
    const out: Array<{ wallet: string; earnedStroops: bigint }> = [];
    for (let i = 0; i < rows.length; i += 2) {
      const wallet = rows[i]!;
      const score = rows[i + 1]!;
      out.push({ wallet, earnedStroops: BigInt(score) });
    }
    return out;
  }

  // ---- All-players leaderboard (backend-tracked, all modes) ----

  async recordGameResult(wallet: string, won: boolean): Promise<void> {
    if (!wallet || wallet === "vault") return;
    await this.redis.zincrby("lb:games", 1, wallet);
    if (won) {
      await this.redis.zincrby("lb:wins", 1, wallet);
      // Bump current streak, then update best to max(current, best).
      const current = Number(
        await this.redis.zincrby("lb:streak:current", 1, wallet),
      );
      // ZADD with GT only writes if the new score beats the existing one,
      // giving us best = max(best, current) atomically.
      await this.redis.zadd("lb:streak:best", "GT", current, wallet);
    } else {
      await this.redis.zincrby("lb:losses", 1, wallet);
      // Reset current streak to 0 — best is sticky.
      await this.redis.zadd("lb:streak:current", 0, wallet);
    }
  }

  async getStreaks(
    wallet: string,
  ): Promise<{ current: number; best: number }> {
    const [c, b] = await Promise.all([
      this.redis.zscore("lb:streak:current", wallet),
      this.redis.zscore("lb:streak:best", wallet),
    ]);
    return { current: Number(c) || 0, best: Number(b) || 0 };
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

  // ---- Onboarding (one-shot friendbot funding per address) ----
  //
  // Used when a Privy user first signs in: the embedded Stellar wallet
  // has 0 XLM, so the backend hits friendbot once and sets a flag so
  // the same address can't be re-funded on every reload.

  async wasFunded(walletAddress: string): Promise<boolean> {
    return (await this.redis.exists(`onboard:funded:${walletAddress}`)) === 1;
  }

  async markFunded(walletAddress: string): Promise<void> {
    // No TTL — funding is one-shot per address forever.
    await this.redis.set(`onboard:funded:${walletAddress}`, "1");
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
