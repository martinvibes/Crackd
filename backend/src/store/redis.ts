/**
 * Singleton Redis client. Used for ephemeral game state storage.
 *
 * Keys are TTL'd so abandoned games don't leak memory — see `gameState.ts`.
 */
import { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export type RedisClient = Redis;

export function createRedis(cfg: AppConfig): Redis {
  const client = new Redis(cfg.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  client.on("connect", () => logger.info("redis connected"));
  client.on("error", (err: Error) => logger.error({ err }, "redis error"));
  return client;
}
