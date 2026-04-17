import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

const addressSchema = z.string().startsWith("G").length(56);

export function playerRouter(services: Services): Router {
  const r = Router();

  /**
   * PUT /api/player/:walletAddress/username — set or update display name.
   */
  r.put("/player/:walletAddress/username", async (req, res, next) => {
    try {
      const wallet = addressSchema.parse(req.params.walletAddress);
      const body = z.object({ username: z.string().min(1).max(20) }).parse(req.body);
      await services.gameStore.setUsername(wallet, body.username.trim());
      res.json({ ok: true, username: body.username.trim() });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Username must be 1-20 characters" });
        return;
      }
      next(err);
    }
  });

  /**
   * PUT /api/player/:walletAddress/avatar — upload profile picture as
   * base64 data URL. Frontend resizes to 128×128 before sending.
   */
  r.put("/player/:walletAddress/avatar", async (req, res, next) => {
    try {
      const wallet = addressSchema.parse(req.params.walletAddress);
      const body = z
        .object({ image: z.string().startsWith("data:image/") })
        .parse(req.body);
      await services.gameStore.setAvatar(wallet, body.image);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid image format" });
        return;
      }
      next(err);
    }
  });

  /**
   * GET /api/player/:walletAddress
   *
   * Returns unified gameplay stats + per-asset earnings + per-asset
   * daily allowance remaining.
   */
  r.get("/player/:walletAddress", async (req, res, next) => {
    try {
      const wallet = addressSchema.parse(req.params.walletAddress);

      const assets = services.assets.list();
      const [stats, earningsMap, username, avatarUrl, redisWins, redisLosses, redisGames, ...dailies] = await Promise.all([
        services.stellar.getPlayerStats(wallet),
        services.stellar.getPlayerEarnings(wallet),
        services.gameStore.getUsername(wallet),
        services.gameStore.getAvatar(wallet),
        services.gameStore["redis"].zscore("lb:wins", wallet),
        services.gameStore["redis"].zscore("lb:losses", wallet),
        services.gameStore["redis"].zscore("lb:games", wallet),
        ...assets.map((a) => services.stellar.getDailyRemaining(wallet, a.symbol)),
      ]);

      const perAsset = assets.map((a, i) => {
        const earnedStroops = earningsMap[a.sac] ?? 0n;
        const daily = dailies[i] ?? 0n;
        return {
          asset: a.symbol,
          displayName: a.displayName,
          totalEarned: stroopsToXlm(earnedStroops as bigint),
          totalEarnedStroops: (earnedStroops as bigint).toString(),
          dailyRemaining: stroopsToXlm(daily as bigint),
        };
      });

      res.json({
        wallet,
        username: username ?? null,
        avatarUrl: avatarUrl ?? null,
        // All-modes totals (Redis-tracked, includes free + casual + staked)
        wins: Number(redisWins) || stats.wins,
        losses: Number(redisLosses) || stats.losses,
        gamesPlayed: Number(redisGames) || stats.gamesPlayed,
        // On-chain staked stats (from CrackdVault contract)
        stakedWins: stats.wins,
        stakedLosses: stats.losses,
        stakedGames: stats.gamesPlayed,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        assets: perAsset,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid wallet address", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  return r;
}
