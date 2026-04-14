/**
 * Crackd backend entry point.
 *
 * Boot sequence:
 *  1. Load + validate env
 *  2. Build services (stellar / ai / redis / gameStore)
 *  3. Start Express w/ REST routes
 *  4. (Phase 3) attach Socket.io to the same HTTP server
 *  5. Graceful shutdown
 */
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { buildServices } from "./services/services.js";
import { logger } from "./utils/logger.js";
import { poolRouter } from "./routes/pool.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { playerRouter } from "./routes/player.js";
import { gameRouter } from "./routes/game.js";

async function main() {
  const cfg = loadConfig();
  const services = buildServices(cfg);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use(
    cors({
      origin: cfg.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  app.get("/health", async (_req, res) => {
    res.json({ ok: true, ts: Date.now(), network: cfg.STELLAR_NETWORK });
  });

  app.use("/api", poolRouter(services));
  app.use("/api", leaderboardRouter(services));
  app.use("/api", playerRouter(services));
  app.use("/api", gameRouter(services));

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    req.log?.error({ err }, "unhandled route error");
    res.status(500).json({ error: "internal server error" });
  };
  app.use(errorHandler);

  const httpServer = createServer(app);
  httpServer.listen(cfg.PORT, () => {
    logger.info(`Crackd backend listening on :${cfg.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`received ${signal}, shutting down`);
    httpServer.close(() => logger.info("http closed"));
    await services.redis.quit().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "fatal boot error");
  process.exit(1);
});
