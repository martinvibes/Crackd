/**
 * Shared service container — constructed once at startup and passed
 * around via `req.app.locals` / socket context. Makes testing easy
 * because every service takes its deps as constructor args.
 */
import type { Redis } from "ioredis";
import { AIService } from "./aiService.js";
import { StellarService } from "./stellarService.js";
import { buildAssetRegistry, type AssetRegistry } from "./assets.js";
import { GameStateStore } from "../store/gameState.js";
import { createRedis } from "../store/redis.js";
import type { AppConfig } from "../config.js";

export interface Services {
  cfg: AppConfig;
  redis: Redis;
  stellar: StellarService;
  ai: AIService;
  gameStore: GameStateStore;
  assets: AssetRegistry;
}

export function buildServices(cfg: AppConfig): Services {
  const redis = createRedis(cfg);
  const assets = buildAssetRegistry(cfg);
  return {
    cfg,
    redis,
    assets,
    stellar: new StellarService(cfg, assets),
    ai: new AIService(cfg),
    gameStore: new GameStateStore(redis, cfg),
  };
}
