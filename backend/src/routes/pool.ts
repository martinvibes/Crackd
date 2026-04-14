import { Router } from "express";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

const assetQuery = z.object({ asset: z.string().optional() });

export function poolRouter(services: Services): Router {
  const r = Router();

  /**
   * GET /api/pool-balance?asset=XLM (default)
   */
  r.get("/pool-balance", async (req, res, next) => {
    try {
      const { asset = "XLM" } = assetQuery.parse(req.query);
      if (!services.assets.isSupported(asset)) {
        res.status(400).json({ error: `Unsupported asset: ${asset}` });
        return;
      }
      const stroops = await services.stellar.getPoolBalance(asset);
      res.json({
        asset,
        balance: stroopsToXlm(stroops),
        balanceStroops: stroops.toString(),
        lastUpdated: Date.now(),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/pool-balances — all supported assets in one call.
   */
  r.get("/pool-balances", async (_req, res, next) => {
    try {
      const assets = services.assets.list();
      const results = await Promise.all(
        assets.map(async (a) => {
          const s = await services.stellar.getPoolBalance(a.symbol);
          return {
            asset: a.symbol,
            displayName: a.displayName,
            balance: stroopsToXlm(s),
            balanceStroops: s.toString(),
          };
        }),
      );
      res.json({ balances: results, lastUpdated: Date.now() });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/assets — list of supported staking assets (frontend uses this
   * to render the asset picker).
   */
  r.get("/assets", (_req, res) => {
    res.json({
      assets: services.assets.list().map((a) => ({
        symbol: a.symbol,
        displayName: a.displayName,
        decimals: a.decimals,
        sac: a.sac,
        isNative: a.isNative,
      })),
    });
  });

  return r;
}
