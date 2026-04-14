import { Router } from "express";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

export function leaderboardRouter(services: Services): Router {
  const r = Router();

  r.get("/leaderboard", async (_req, res, next) => {
    try {
      const entries = await services.stellar.getLeaderboard();
      res.json({
        leaderboard: entries.map((e, idx) => ({
          rank: idx + 1,
          player: e.player,
          totalEarnedXlm: stroopsToXlm(e.totalEarned),
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
