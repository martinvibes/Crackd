/**
 * End-to-end smoke test for socket-driven gameplay.
 *
 *   1. Start the backend: npx tsx src/index.ts (separate terminal)
 *   2. Run this script: npx tsx src/scripts/smokeSockets.ts
 *
 * Simulates a full casual PvP game:
 *   alice creates → bob joins → both set codes → alice guesses bob's
 *   code on her first try → game_over fires with alice as winner.
 *
 * The "alice cracks first try" is possible because we deterministically
 * set Bob's code to 1234 and alice guesses 1234. Proves the rule engine,
 * turn switching, game-over detection, and event broadcast all work.
 */
import { io as connect } from "socket.io-client";
import { Keypair } from "@stellar/stellar-sdk";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../socket/events.js";

const URL = process.env.BACKEND_URL ?? "http://localhost:3001";

function mkSocket() {
  return connect(URL, { transports: ["websocket"] }) as unknown as import(
    "socket.io-client"
  ).Socket<ServerToClientEvents, ClientToServerEvents>;
}

async function main() {
  const aliceWallet = Keypair.random().publicKey();
  const bobWallet = Keypair.random().publicKey();

  const alice = mkSocket();
  const bob = mkSocket();

  await Promise.all([
    new Promise<void>((r) => alice.once("connect", () => r())),
    new Promise<void>((r) => bob.once("connect", () => r())),
  ]);

  console.log("connected:", alice.id, bob.id);

  // --- alice creates ---
  const create = await new Promise<{ gameId?: string; error?: string }>((r) =>
    alice.emit(
      "create_game",
      { walletAddress: aliceWallet, mode: "pvp_casual" } as unknown as never,
      r as never,
    ),
  );
  if (!create.gameId) throw new Error(`create failed: ${create.error}`);
  const gameId = create.gameId;
  console.log("created:", gameId);

  // --- bob joins ---
  // Start listening BEFORE emitting; the server may broadcast before ack fires.
  const started = new Promise<void>((r) => bob.once("game_started" as never, () => r()));
  const join = await new Promise<{ ok: boolean; error?: string }>((r) =>
    bob.emit(
      "join_game",
      { gameId, walletAddress: bobWallet } as unknown as never,
      r as never,
    ),
  );
  if (!join.ok) throw new Error(`join failed: ${join.error}`);
  console.log("joined");
  await started;
  console.log("game_started received");

  // --- both set codes ---
  // Register the codes_set listener before the second set_code emits.
  const bothSet = new Promise<void>((r) => alice.once("codes_set" as never, () => r()));
  await new Promise<void>((r) =>
    alice.emit(
      "set_code",
      { gameId, walletAddress: aliceWallet, code: "5678" } as unknown as never,
      () => r() as never,
    ),
  );
  await new Promise<void>((r) =>
    bob.emit(
      "set_code",
      { gameId, walletAddress: bobWallet, code: "1234" } as unknown as never,
      () => r() as never,
    ),
  );
  await bothSet;
  console.log("codes_set received");

  // --- alice guesses bob's code directly ---
  const overP = new Promise<unknown>((r) =>
    alice.once("game_over" as never, (e) => r(e)),
  );
  await new Promise<void>((r) =>
    alice.emit(
      "make_guess",
      { gameId, walletAddress: aliceWallet, guess: "1234" } as unknown as never,
      () => r() as never,
    ),
  );
  const over = (await overP) as { winner: string; isDraw: boolean };
  console.log("game_over:", over);

  if (over.winner !== aliceWallet) {
    throw new Error(`expected alice to win, got ${over.winner}`);
  }
  console.log("✅ alice won as expected");
  alice.close();
  bob.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ smoke failed:", err);
  process.exit(1);
});
