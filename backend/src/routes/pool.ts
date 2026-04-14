import { Router } from "express";
import type { Services } from "../services/services.js";
import { stroopsToXlm } from "../utils/units.js";

export function poolRouter(services: Services): Router {
  const r = Router();

  r.get("/pool-balance", async (_req, res, next) => {
    try {
      const stroops = await services.stellar.getPoolBalance();
      res.json({
        balanceXlm: stroopsToXlm(stroops),
        balanceStroops: stroops.toString(),
        lastUpdated: Date.now(),
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
