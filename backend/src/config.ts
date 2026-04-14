/**
 * Typed environment configuration.
 *
 * Fails loudly at startup if anything required is missing — better than
 * discovering a missing env var mid-game when a stake transaction is
 * already in flight.
 */
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Load .env.local first (developer overrides, gitignored), then .env.
// `override: false` means later calls never clobber earlier ones — so
// .env.local wins, which is the expected precedence.
const here = path.dirname(fileURLToPath(import.meta.url));
// `here` is .../backend/src in dev (tsx) and .../backend/dist in prod.
// Walk up until we find a package.json — that's the backend root.
function findBackendRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.resolve(dir, "..");
  }
  return start;
}
const backendRoot = findBackendRoot(here);
loadDotenv({ path: path.join(backendRoot, ".env.local"), override: false });
loadDotenv({ path: path.join(backendRoot, ".env"), override: false });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  ADMIN_PUBLIC_KEY: z.string().startsWith("G").length(56),
  ADMIN_SECRET_KEY: z.string().startsWith("S").length(56),
  NATIVE_XLM_SAC: z.string().startsWith("C").length(56),
  USDC_SAC: z.string().startsWith("C").length(56),
  SUPPORTED_ASSETS: z.string().default("XLM,USDC"),
  CRACKD_VAULT_ID: z.string().startsWith("C").length(56),
  CRACKD_DUEL_ID: z.string().startsWith("C").length(56),

  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-6"),
  CLAUDE_MAX_TOKENS: z.coerce.number().int().positive().default(200),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  GAME_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(7200),
  CHAT_RATE_LIMIT_MS: z.coerce.number().int().nonnegative().default(3000),
  TAUNT_RATE_LIMIT_MS: z.coerce.number().int().nonnegative().default(30000),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Test helper — forget the cached config so tests can swap env vars.
 */
export function resetConfigForTests(): void {
  cached = undefined;
}
