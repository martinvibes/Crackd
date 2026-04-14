import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

const query = z.object({ asset: z.string().optional() });

export function leaderboardRouter(services: Services): Router {
  const r = Router();

  /**
   * GET /api/leaderboard?asset=XLM (default) → top-10 in that asset.
   */
  r.get("/leaderboard", async (req, res, next) => {
    try {
      const { asset = "XLM" } = query.parse(req.query);
      if (!services.assets.isSupported(asset)) {
        res.status(400).json({ error: `Unsupported asset: ${asset}` });
        return;
      }
      const entries = await services.stellar.getLeaderboard(asset);
      res.json({
        asset,
        leaderboard: entries.map((e, idx) => ({
          rank: idx + 1,
          player: e.player,
          totalEarned: stroopsToXlm(e.totalEarned),
          totalEarnedStroops: e.totalEarned.toString(),
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
