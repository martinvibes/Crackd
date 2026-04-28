/**
 * POST /api/onboarding/fund
 *
 * Body: { walletAddress: string }
 *
 * Friendbot-funds a fresh Stellar testnet address. Idempotent: a Redis
 * flag (set on first success) makes repeat calls no-ops. Friendbot
 * failures are non-fatal — we return 200 with `funded: false` so the
 * frontend can keep the user in the app rather than blocking sign-in
 * on a flaky external service.
 */
import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const body = z.object({
  walletAddress: z.string().startsWith("G").length(56),
});

export function onboardingRouter(services: Services, cfg: AppConfig): Router {
  const r = Router();

  r.post("/onboarding/fund", async (req, res, next) => {
    try {
      const { walletAddress } = body.parse(req.body);

      if (await services.gameStore.wasFunded(walletAddress)) {
        res.json({ funded: false, alreadyFunded: true });
        return;
      }

      const url = `${cfg.STELLAR_FRIENDBOT_URL}?addr=${encodeURIComponent(walletAddress)}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          const text = await resp.text();
          logger.warn(
            { walletAddress, status: resp.status, body: text.slice(0, 300) },
            "friendbot returned non-2xx",
          );
          res.json({ funded: false, alreadyFunded: false });
          return;
        }
        await services.gameStore.markFunded(walletAddress);
        logger.info({ walletAddress }, "onboarding: friendbot funded");
        res.json({ funded: true, alreadyFunded: false });
      } catch (err) {
        logger.warn({ err, walletAddress }, "friendbot fetch failed");
        res.json({ funded: false, alreadyFunded: false });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid wallet address" });
        return;
      }
      next(err);
    }
  });

  return r;
}
