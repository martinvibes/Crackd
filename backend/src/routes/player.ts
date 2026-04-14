import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

const addressSchema = z.string().startsWith("G").length(56);

export function playerRouter(services: Services): Router {
  const r = Router();

  r.get("/player/:walletAddress", async (req, res, next) => {
    try {
      const wallet = addressSchema.parse(req.params.walletAddress);
      const [stats, dailyRemaining] = await Promise.all([
        services.stellar.getPlayerStats(wallet),
        services.stellar.getDailyRemaining(wallet),
      ]);
      res.json({
        wallet,
        wins: stats.wins,
        losses: stats.losses,
        gamesPlayed: stats.gamesPlayed,
        totalEarnedXlm: stroopsToXlm(stats.totalEarned),
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        dailyRemainingXlm: stroopsToXlm(dailyRemaining),
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
