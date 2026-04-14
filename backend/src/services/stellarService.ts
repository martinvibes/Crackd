/**
 * Thin wrapper around @stellar/stellar-sdk for the two Crackd contracts.
 *
 * Design notes:
 * - Read methods use rpc.simulateTransaction — no ledger cost, no admin signing.
 * - Admin-write methods build, sign (admin secret), and submit via rpc.
 * - Player-write methods accept an already-signed XDR (frontend signs via
 *   wallet kit) and just submit it; the backend never touches the player's
 *   secret.
 */
import {
  Address,
  Contract,
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export interface PlayerStatsOnChain {
  wins: number;
  losses: number;
  totalEarned: bigint;
  bestStreak: number;
  currentStreak: number;
  gamesPlayed: number;
}

export interface LeaderboardEntryOnChain {
  player: string;
  totalEarned: bigint;
  wins: number;
  bestStreak: number;
}

export interface DuelGameOnChain {
  gameId: string;
  playerOne: string;
  playerTwo: string | null;
  stakeAmount: bigint;
  status: "Waiting" | "Active" | "Completed" | "Refunded" | "Expired";
  createdAt: number;
  winner: string | null;
  payout: bigint | null;
}

export class StellarService {
  private readonly rpcServer: rpc.Server;
  private readonly networkPassphrase: string;
  private readonly admin: Keypair;
  private readonly vault: Contract;
  private readonly duel: Contract;
  private readonly baseFee = "1000000"; // 0.1 XLM — Soroban txs fee; safe cap.

  constructor(private readonly cfg: AppConfig) {
    this.rpcServer = new rpc.Server(cfg.STELLAR_RPC_URL, { allowHttp: cfg.STELLAR_NETWORK !== "mainnet" });
    this.networkPassphrase =
      cfg.STELLAR_NETWORK_PASSPHRASE ||
      (cfg.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET);
    this.admin = Keypair.fromSecret(cfg.ADMIN_SECRET_KEY);
    this.vault = new Contract(cfg.CRACKD_VAULT_ID);
    this.duel = new Contract(cfg.CRACKD_DUEL_ID);
  }

  // ---------- Reads ----------

  async getPoolBalance(): Promise<bigint> {
    const result = await this.simulate(this.vault, "get_pool_balance", []);
    return scValToNative(result) as bigint;
  }

  async getPlayerStats(playerPublicKey: string): Promise<PlayerStatsOnChain> {
    const result = await this.simulate(this.vault, "get_player_stats", [
      Address.fromString(playerPublicKey).toScVal(),
    ]);
    const stats = scValToNative(result) as {
      wins: number;
      losses: number;
      total_earned: bigint;
      best_streak: number;
      current_streak: number;
      games_played: number;
    };
    return {
      wins: stats.wins,
      losses: stats.losses,
      totalEarned: stats.total_earned,
      bestStreak: stats.best_streak,
      currentStreak: stats.current_streak,
      gamesPlayed: stats.games_played,
    };
  }

  async getLeaderboard(): Promise<LeaderboardEntryOnChain[]> {
    const result = await this.simulate(this.vault, "get_leaderboard", []);
    const entries = scValToNative(result) as Array<{
      player: string;
      total_earned: bigint;
      wins: number;
      best_streak: number;
    }>;
    return entries.map((e) => ({
      player: e.player,
      totalEarned: e.total_earned,
      wins: e.wins,
      bestStreak: e.best_streak,
    }));
  }

  async getDailyRemaining(playerPublicKey: string): Promise<bigint> {
    const result = await this.simulate(this.vault, "get_daily_remaining", [
      Address.fromString(playerPublicKey).toScVal(),
    ]);
    return scValToNative(result) as bigint;
  }

  async getDuelGame(contractGameIdHex: string): Promise<DuelGameOnChain> {
    const idBytes = hexToBytesN32(contractGameIdHex);
    const result = await this.simulate(this.duel, "get_game", [
      nativeToScVal(idBytes, { type: "bytes" }),
    ]);
    const raw = scValToNative(result) as {
      game_id: Buffer;
      player_one: string;
      player_two: string | null;
      stake_amount: bigint;
      status: string | { tag: string };
      created_at: bigint;
      winner: string | null;
      payout: bigint | null;
    };
    return {
      gameId: Buffer.from(raw.game_id).toString("hex"),
      playerOne: raw.player_one,
      playerTwo: raw.player_two,
      stakeAmount: raw.stake_amount,
      status: typeof raw.status === "string" ? (raw.status as DuelGameOnChain["status"]) : (raw.status.tag as DuelGameOnChain["status"]),
      createdAt: Number(raw.created_at),
      winner: raw.winner,
      payout: raw.payout,
    };
  }

  // ---------- Admin writes (vault) ----------

  async resolveWin(
    playerPublicKey: string,
    stakeStroops: bigint,
    guessesUsed: number,
  ): Promise<{ txHash: string; bonus: bigint }> {
    const { txHash, returnValue } = await this.invokeAsAdmin(
      this.vault,
      "resolve_win",
      [
        Address.fromString(playerPublicKey).toScVal(),
        nativeToScVal(stakeStroops, { type: "i128" }),
        nativeToScVal(guessesUsed, { type: "u32" }),
      ],
    );
    const bonus = scValToNative(returnValue) as bigint;
    return { txHash, bonus };
  }

  async resolveLoss(playerPublicKey: string): Promise<string> {
    const { txHash } = await this.invokeAsAdmin(this.vault, "resolve_loss", [
      Address.fromString(playerPublicKey).toScVal(),
    ]);
    return txHash;
  }

  // ---------- Admin writes (duel) ----------

  async declareDuelWinner(
    contractGameIdHex: string,
    winnerPublicKey: string,
  ): Promise<string> {
    const idBytes = hexToBytesN32(contractGameIdHex);
    const { txHash } = await this.invokeAsAdmin(this.duel, "declare_winner", [
      nativeToScVal(idBytes, { type: "bytes" }),
      Address.fromString(winnerPublicKey).toScVal(),
    ]);
    return txHash;
  }

  async declareDuelDraw(contractGameIdHex: string): Promise<string> {
    const idBytes = hexToBytesN32(contractGameIdHex);
    const { txHash } = await this.invokeAsAdmin(this.duel, "declare_draw", [
      nativeToScVal(idBytes, { type: "bytes" }),
    ]);
    return txHash;
  }

  // ---------- Player-submitted txs (already signed by wallet) ----------

  /**
   * Accept an already-signed Transaction XDR from the frontend (player's
   * wallet signed it) and submit it to the network.
   */
  async submitSignedTransaction(signedXdr: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase) as Transaction;
    const send = await this.rpcServer.sendTransaction(tx);
    if (send.status !== "PENDING") {
      throw new Error(
        `sendTransaction failed: status=${send.status}, errorResult=${JSON.stringify(send.errorResult)}`,
      );
    }
    return await this.pollForCompletion(send.hash);
  }

  // ---------- Internals ----------

  private async simulate(
    contract: Contract,
    method: string,
    args: xdr.ScVal[],
  ): Promise<xdr.ScVal> {
    const source = await this.rpcServer.getAccount(this.admin.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: this.baseFee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await this.rpcServer.simulateTransaction(tx);
    if ("error" in sim && sim.error) {
      throw new Error(`simulate(${method}) failed: ${sim.error}`);
    }
    const ret = (sim as rpc.Api.SimulateTransactionSuccessResponse).result
      ?.retval;
    if (!ret) throw new Error(`simulate(${method}) returned no value`);
    return ret;
  }

  private async invokeAsAdmin(
    contract: Contract,
    method: string,
    args: xdr.ScVal[],
  ): Promise<{ txHash: string; returnValue: xdr.ScVal }> {
    const source = await this.rpcServer.getAccount(this.admin.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: this.baseFee,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();

    const prepared = await this.rpcServer.prepareTransaction(tx);
    prepared.sign(this.admin);

    const send = await this.rpcServer.sendTransaction(prepared);
    if (send.status !== "PENDING") {
      throw new Error(
        `sendTransaction(${method}) failed: status=${send.status}, errorResult=${JSON.stringify(send.errorResult)}`,
      );
    }
    const txHash = await this.pollForCompletion(send.hash);
    // Fetch the final transaction to pull out the return value.
    const final = await this.rpcServer.getTransaction(txHash);
    if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`tx ${txHash} finished with status ${final.status}`);
    }
    const retval = final.returnValue;
    if (!retval) throw new Error(`tx ${txHash} has no return value`);
    logger.info({ method, txHash }, "soroban tx completed");
    return { txHash, returnValue: retval };
  }

  /**
   * Poll getTransaction until it's SUCCESS or FAILED. Max ~40s.
   */
  private async pollForCompletion(hash: string): Promise<string> {
    for (let i = 0; i < 40; i++) {
      const res = await this.rpcServer.getTransaction(hash);
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash;
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`tx ${hash} failed on-chain: ${JSON.stringify(res.resultXdr)}`);
      }
      await sleep(1000);
    }
    throw new Error(`tx ${hash} did not complete within timeout`);
  }
}

// --------------------------- helpers ---------------------------

function hexToBytesN32(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error(`Expected 32-byte hex, got ${hex.length} chars`);
  }
  return Buffer.from(clean, "hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
