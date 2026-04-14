/**
 * Thin wrapper around @stellar/stellar-sdk for the multi-asset Crackd
 * contracts.
 *
 * Most methods take an `asset` parameter (symbol like "XLM" or "USDC"),
 * resolved to a SAC address via the `AssetRegistry`. This keeps callers
 * denomination-agnostic — they just pick the asset.
 *
 * Reads go through `simulateTransaction` (no ledger cost).
 * Admin writes build, sign, and submit with the admin keypair.
 * Player writes accept a pre-signed XDR from the wallet kit.
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
import type { AssetRegistry, AssetSymbol } from "./assets.js";

export interface PlayerStatsOnChain {
  wins: number;
  losses: number;
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
  token: string;
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
  private readonly baseFee = "1000000";

  constructor(
    cfg: AppConfig,
    private readonly assets: AssetRegistry,
  ) {
    this.rpcServer = new rpc.Server(cfg.STELLAR_RPC_URL, {
      allowHttp: cfg.STELLAR_NETWORK !== "mainnet",
    });
    this.networkPassphrase =
      cfg.STELLAR_NETWORK_PASSPHRASE ||
      (cfg.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET);
    this.admin = Keypair.fromSecret(cfg.ADMIN_SECRET_KEY);
    this.vault = new Contract(cfg.CRACKD_VAULT_ID);
    this.duel = new Contract(cfg.CRACKD_DUEL_ID);
  }

  private tokenScVal(asset: AssetSymbol): xdr.ScVal {
    return Address.fromString(this.assets.get(asset).sac).toScVal();
  }

  // ---------- Vault reads ----------

  async getPoolBalance(asset: AssetSymbol): Promise<bigint> {
    const result = await this.simulate(this.vault, "get_pool_balance", [
      this.tokenScVal(asset),
    ]);
    return scValToNative(result) as bigint;
  }

  async getPlayerStats(playerPublicKey: string): Promise<PlayerStatsOnChain> {
    const result = await this.simulate(this.vault, "get_player_stats", [
      Address.fromString(playerPublicKey).toScVal(),
    ]);
    const stats = scValToNative(result) as {
      wins: number;
      losses: number;
      best_streak: number;
      current_streak: number;
      games_played: number;
    };
    return {
      wins: stats.wins,
      losses: stats.losses,
      bestStreak: stats.best_streak,
      currentStreak: stats.current_streak,
      gamesPlayed: stats.games_played,
    };
  }

  async getPlayerEarnings(
    playerPublicKey: string,
  ): Promise<Record<string, bigint>> {
    const result = await this.simulate(this.vault, "get_player_earnings", [
      Address.fromString(playerPublicKey).toScVal(),
    ]);
    // scValToNative returns Map as plain object-like; normalise to Record.
    const raw = scValToNative(result) as Record<string, bigint> | Map<string, bigint>;
    if (raw instanceof Map) {
      return Object.fromEntries(raw.entries());
    }
    return raw;
  }

  async getLeaderboard(asset: AssetSymbol): Promise<LeaderboardEntryOnChain[]> {
    const result = await this.simulate(this.vault, "get_leaderboard", [
      this.tokenScVal(asset),
    ]);
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

  async getDailyRemaining(
    playerPublicKey: string,
    asset: AssetSymbol,
  ): Promise<bigint> {
    const result = await this.simulate(this.vault, "get_daily_remaining", [
      Address.fromString(playerPublicKey).toScVal(),
      this.tokenScVal(asset),
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
      token: string;
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
      token: raw.token,
      stakeAmount: raw.stake_amount,
      status:
        typeof raw.status === "string"
          ? (raw.status as DuelGameOnChain["status"])
          : (raw.status.tag as DuelGameOnChain["status"]),
      createdAt: Number(raw.created_at),
      winner: raw.winner,
      payout: raw.payout,
    };
  }

  // ---------- Vault admin writes ----------

  async resolveWin(
    playerPublicKey: string,
    asset: AssetSymbol,
    stakeStroops: bigint,
    guessesUsed: number,
  ): Promise<{ txHash: string; bonus: bigint }> {
    const { txHash, returnValue } = await this.invokeAsAdmin(
      this.vault,
      "resolve_win",
      [
        Address.fromString(playerPublicKey).toScVal(),
        this.tokenScVal(asset),
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

  // ---------- Duel admin writes ----------

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

  // ---------- Player-submitted (pre-signed by wallet) ----------

  async submitSignedTransaction(signedXdr: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(
      signedXdr,
      this.networkPassphrase,
    ) as Transaction;
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
    const final = await this.rpcServer.getTransaction(txHash);
    if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`tx ${txHash} finished with status ${final.status}`);
    }
    const retval = final.returnValue;
    if (!retval) throw new Error(`tx ${txHash} has no return value`);
    logger.info({ method, txHash }, "soroban tx completed");
    return { txHash, returnValue: retval };
  }

  private async pollForCompletion(hash: string): Promise<string> {
    for (let i = 0; i < 40; i++) {
      const res = await this.rpcServer.getTransaction(hash);
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash;
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`tx ${hash} failed: ${JSON.stringify(res.resultXdr)}`);
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
