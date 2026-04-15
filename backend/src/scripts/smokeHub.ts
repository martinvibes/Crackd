/**
 * Smoke test — prove we can call start_game + end_game on the Stellar
 * Game Studio Hub with our admin signer.
 *
 *   npx tsx src/scripts/smokeHub.ts
 *
 * This uses two dummy player Addresses (the admin twice and another
 * throwaway keypair) so no real wallets are involved. The Hub just
 * records a session from our admin.
 */
import { Keypair } from "@stellar/stellar-sdk";
import { loadConfig } from "../config.js";
import { buildServices } from "../services/services.js";
import { logger } from "../utils/logger.js";

async function main() {
  const cfg = loadConfig();
  const services = buildServices(cfg);

  const sessionId = await services.gameStore.nextHubSessionId();
  const p1 = cfg.ADMIN_PUBLIC_KEY;
  const p2 = Keypair.random().publicKey();

  logger.info({ sessionId, p1, p2 }, "calling hub.start_game");
  const started = await services.stellar.hubStartGame(sessionId, p1, p2);
  logger.info({ started }, "start_game result");

  logger.info({ sessionId }, "calling hub.end_game");
  const ended = await services.stellar.hubEndGame(sessionId, true);
  logger.info({ ended }, "end_game result");

  await services.redis.quit();
}

main().catch((err) => {
  logger.fatal({ err }, "smoke failed");
  process.exit(1);
});
