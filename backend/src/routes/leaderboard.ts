import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

const query = z.object({ asset: z.string().optional() });

export function leaderboardRouter(services: Services): Router {
  const r = Router();

  /**
   * GET /api/leaderboard/all → backend-tracked, all modes, ranked by wins.
   */
  r.get("/leaderboard/all", async (_req, res, next) => {
    try {
      const rows = await services.gameStore.getAllPlayersLeaderboard(20);
      const ids = await services.gameStore.resolveIdentities(
        rows.map((r) => r.wallet),
      );
      res.json({
        leaderboard: rows.map((r, i) => ({
          rank: i + 1,
          player: r.wallet,
          username: ids[r.wallet]?.username ?? null,
          avatarUrl: ids[r.wallet]?.avatarUrl ?? null,
          wins: r.wins,
          losses: r.losses,
          gamesPlayed: r.games,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/leaderboard?asset=XLM (default) → top-10 in that asset,
   * combining vs-AI vault earnings (on-chain) with PvP duel earnings
   * (Redis-tracked because the duel contract has no per-player ledger).
   * Players who only have one source still show; rank is by combined.
   */
  r.get("/leaderboard", async (req, res, next) => {
    try {
      const { asset = "XLM" } = query.parse(req.query);
      if (!services.assets.isSupported(asset)) {
        res.status(400).json({ error: `Unsupported asset: ${asset}` });
        return;
      }
      const sac = services.assets.get(asset as never).sac;

      const [vaultEntries, pvpEntries] = await Promise.all([
        services.stellar.getLeaderboard(asset),
        services.gameStore.getPvpLeaderboard(sac, 100),
      ]);

      // Union by wallet, sum earnings. Track best-streak from the vault
      // contract (it's the only source) but use the cross-mode wins
      // count from Redis (`lb:wins`) so PvP-only players don't show 0.
      type Row = {
        player: string;
        vaultStroops: bigint;
        pvpStroops: bigint;
        bestStreak: number;
      };
      const byWallet = new Map<string, Row>();
      for (const e of vaultEntries) {
        byWallet.set(e.player, {
          player: e.player,
          vaultStroops: e.totalEarned,
          pvpStroops: 0n,
          bestStreak: e.bestStreak,
        });
      }
      for (const p of pvpEntries) {
        const existing = byWallet.get(p.wallet);
        if (existing) {
          existing.pvpStroops = p.earnedStroops;
        } else {
          byWallet.set(p.wallet, {
            player: p.wallet,
            vaultStroops: 0n,
            pvpStroops: p.earnedStroops,
            bestStreak: 0,
          });
        }
      }

      const candidates = [...byWallet.values()]
        .map((r) => ({ ...r, totalStroops: r.vaultStroops + r.pvpStroops }))
        .sort((a, b) => {
          if (a.totalStroops > b.totalStroops) return -1;
          if (a.totalStroops < b.totalStroops) return 1;
          return 0;
        })
        .slice(0, 10);

      // Pull cross-mode wins + best-streak (Redis) for the final 10
      // in a single pipeline. We use the cross-mode values as the
      // displayed wins/best so PvP-only players don't show 0.
      const pipe = services.gameStore["redis"].pipeline();
      for (const c of candidates) {
        pipe.zscore("lb:wins", c.player);
        pipe.zscore("lb:streak:best", c.player);
      }
      const results = (await pipe.exec()) ?? [];
      const merged = candidates.map((c, i) => {
        const winsRaw = results[i * 2]?.[1] as string | null;
        const bestRaw = results[i * 2 + 1]?.[1] as string | null;
        const redisWins = winsRaw ? Number(winsRaw) : 0;
        const redisBest = bestRaw ? Number(bestRaw) : 0;
        // Take the max of (cross-mode Redis, on-chain vault). For
        // players whose wins predate the streak ledger, fall back to
        // a truthful lower bound: any wins at all → best ≥ 1.
        let bestStreak = Math.max(redisBest, c.bestStreak);
        if (bestStreak === 0 && redisWins > 0) bestStreak = 1;
        return { ...c, wins: redisWins, bestStreak };
      });

      const ids = await services.gameStore.resolveIdentities(
        merged.map((e) => e.player),
      );

      res.json({
        asset,
        leaderboard: merged.map((e, idx) => ({
          rank: idx + 1,
          player: e.player,
          username: ids[e.player]?.username ?? null,
          avatarUrl: ids[e.player]?.avatarUrl ?? null,
          totalEarned: stroopsToXlm(e.totalStroops),
          totalEarnedStroops: e.totalStroops.toString(),
          vsAiEarned: stroopsToXlm(e.vaultStroops),
          pvpEarned: stroopsToXlm(e.pvpStroops),
          wins: e.wins,
          bestStreak: e.bestStreak,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
