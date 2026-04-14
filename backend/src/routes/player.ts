import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

const addressSchema = z.string().startsWith("G").length(56);

export function playerRouter(services: Services): Router {
  const r = Router();

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
      const [stats, earningsMap, ...dailies] = await Promise.all([
        services.stellar.getPlayerStats(wallet),
        services.stellar.getPlayerEarnings(wallet),
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
        wins: stats.wins,
        losses: stats.losses,
        gamesPlayed: stats.gamesPlayed,
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
