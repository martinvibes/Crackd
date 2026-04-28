/**
 * Staked PvP socket flow smoke test.
 *
 *   1. Start the backend: npx tsx src/index.ts (separate terminal)
 *   2. Run: npx tsx src/scripts/smokePvpStaked.ts
 *
 * Modes:
 *   - default            (live testnet — friendbot-funds two keypairs,
 *                         signs and submits real create_game / join_game
 *                         transactions, asserts payout tx fires).
 *   - SKIP_ONCHAIN=1     (requires a backend stub that bypasses
 *                         submitSignedTransaction — for future test-mode
 *                         work; currently the backend always submits).
 *
 * The script asserts:
 *   - game_created arrives with a gameId.
 *   - GET /api/game/:gameId returns a non-null contractGameId after create.
 *   - game_started fires after both stake + set codes.
 *   - game_over arrives with winner === aliceWallet and a payoutTxHash
 *     (live mode only).
 *
 * Live mode environment:
 *   - BACKEND_URL              (default http://localhost:3001)
 *   - STELLAR_RPC_URL          (default https://soroban-testnet.stellar.org)
 *   - CRACKD_DUEL_ID           (required — the deployed CrackdDuel address)
 *   - XLM_SAC                  (default Stellar Asset Contract for native XLM)
 */
import { io as connect } from "socket.io-client";
import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../socket/events.js";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const RPC_URL =
  process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const DUEL_ID = process.env.CRACKD_DUEL_ID ?? "";
const XLM_SAC =
  process.env.XLM_SAC ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const STAKE_STROOPS = 10_000_000n; // 1 XLM
const SKIP_ONCHAIN = process.env.SKIP_ONCHAIN === "1";

function mkSocket() {
  return connect(BACKEND_URL, { transports: ["websocket"] }) as unknown as import(
    "socket.io-client"
  ).Socket<ServerToClientEvents, ClientToServerEvents>;
}

async function fundFriendbot(publicKey: string): Promise<void> {
  const url = `https://friendbot.stellar.org/?addr=${publicKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`friendbot for ${publicKey} failed: ${res.status}`);
  }
}

async function buildAndSign(
  rpcServer: rpc.Server,
  signer: Keypair,
  method: "create_game" | "join_game",
  args: xdr.ScVal[],
): Promise<string> {
  const account = await rpcServer.getAccount(signer.publicKey());
  const duel = new Contract(DUEL_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(duel.call(method, ...args))
    .setTimeout(300)
    .build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(signer);
  return prepared.toXDR();
}

async function fetchGame(gameId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BACKEND_URL}/api/game/${gameId}`);
  if (!res.ok) throw new Error(`GET /api/game/${gameId} → ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function main() {
  if (!SKIP_ONCHAIN && !DUEL_ID) {
    throw new Error(
      "CRACKD_DUEL_ID env required for live mode (or set SKIP_ONCHAIN=1)",
    );
  }

  const aliceKp = Keypair.random();
  const bobKp = Keypair.random();
  const aliceWallet = aliceKp.publicKey();
  const bobWallet = bobKp.publicKey();

  if (!SKIP_ONCHAIN) {
    console.log("funding via friendbot…");
    await Promise.all([fundFriendbot(aliceWallet), fundFriendbot(bobWallet)]);
  }

  const rpcServer = new rpc.Server(RPC_URL);

  const alice = mkSocket();
  const bob = mkSocket();
  await Promise.all([
    new Promise<void>((r) => alice.once("connect", () => r())),
    new Promise<void>((r) => bob.once("connect", () => r())),
  ]);
  console.log("connected:", alice.id, bob.id);

  // --- alice creates (with staked XDR) ---
  let aliceSignedXdr: string | undefined;
  if (!SKIP_ONCHAIN) {
    aliceSignedXdr = await buildAndSign(rpcServer, aliceKp, "create_game", [
      Address.fromString(aliceWallet).toScVal(),
      Address.fromString(XLM_SAC).toScVal(),
      nativeToScVal(STAKE_STROOPS, { type: "i128" }),
    ]);
  }
  const create = await new Promise<{ gameId?: string; error?: string }>((r) =>
    alice.emit(
      "create_game",
      {
        walletAddress: aliceWallet,
        mode: "pvp_staked",
        asset: "XLM",
        stakeStroops: STAKE_STROOPS.toString(),
        signedXdr: aliceSignedXdr,
      } as unknown as never,
      r as never,
    ),
  );
  if (!create.gameId) throw new Error(`create failed: ${create.error}`);
  const gameId = create.gameId;
  console.log("created:", gameId);

  // --- verify contractGameId is exposed via REST ---
  const gs = await fetchGame(gameId);
  if (!gs.contractGameId) {
    throw new Error(
      `expected contractGameId in /api/game response, got: ${JSON.stringify(gs)}`,
    );
  }
  console.log("contractGameId:", gs.contractGameId);

  // --- bob joins (with staked XDR) ---
  let bobSignedXdr: string | undefined;
  if (!SKIP_ONCHAIN) {
    bobSignedXdr = await buildAndSign(rpcServer, bobKp, "join_game", [
      Address.fromString(bobWallet).toScVal(),
      nativeToScVal(Buffer.from(gs.contractGameId as string, "hex"), {
        type: "bytes",
      }),
    ]);
  }
  const started = new Promise<void>((r) =>
    bob.once("game_started" as never, () => r()),
  );
  const join = await new Promise<{ ok: boolean; error?: string }>((r) =>
    bob.emit(
      "join_game",
      {
        gameId,
        walletAddress: bobWallet,
        signedXdr: bobSignedXdr,
      } as unknown as never,
      r as never,
    ),
  );
  if (!join.ok) throw new Error(`join failed: ${join.error}`);
  await started;
  console.log("game_started");

  // --- both set codes ---
  const bothSet = new Promise<void>((r) =>
    alice.once("codes_set" as never, () => r()),
  );
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
  console.log("codes_set");

  // --- alice cracks bob's code on her first guess ---
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
  const over = (await overP) as {
    winner: string;
    isDraw: boolean;
    contractGameId: string | null;
    payoutTxHash?: string;
  };
  console.log("game_over:", over);

  if (over.winner !== aliceWallet) {
    throw new Error(`expected alice to win, got ${over.winner}`);
  }
  if (!SKIP_ONCHAIN && !over.payoutTxHash) {
    throw new Error("expected payoutTxHash in live mode");
  }
  console.log("✅ pvp_staked flow OK");
  alice.close();
  bob.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ smokePvpStaked failed:", err);
  process.exit(1);
});
