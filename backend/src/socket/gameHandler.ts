/**
 * Socket.io game handler — the real-time heart of Crackd.
 *
 * One Socket.io room per gameId. Every player has their own socket; both
 * sockets join the same room when both players are present. The server
 * is the single source of truth — game state lives in Redis, not in
 * client memory.
 *
 * Security notes:
 *  - Every event re-validates: (a) the socket is in the game's room,
 *    (b) the walletAddress on the payload matches a slot in that game,
 *    (c) it's that slot's turn (for `make_guess`).
 *  - Secret codes never cross the wire to the opponent until game-over.
 *  - Stake/resolve contract calls are server-driven using admin key;
 *    clients never learn the admin key or trigger it directly.
 */
import type { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import type { Services } from "../services/services.js";
import type {
  ClientToServerEvents,
  S2CGameOver,
  S2CGuessResult,
  ServerToClientEvents,
  SocketData,
} from "./events.js";
import type { GameMode, GameState, PlayerSlot, SafeGameView } from "../types/game.js";
import {
  CODE_LENGTH,
  checkGameOver,
  computeGuessResult,
  createInitialState,
  otherSlot,
  redactForPlayer,
  validateCode,
} from "../services/gameLogic.js";
import { shortAddress } from "../utils/units.js";
import { logger } from "../utils/logger.js";

type CrackdSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type CrackdServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const walletSchema = z.string().startsWith("G").length(56);

export function registerGameHandlers(io: CrackdServer, socket: CrackdSocket, services: Services) {
  socket.data.gameIds = new Set<string>();
  socket.data.lastChatAt = 0;

  // ---------- create_game ----------
  socket.on("create_game", async (payload, ack) => {
    try {
      const walletAddress = walletSchema.parse(payload.walletAddress);
      const mode = payload.mode as GameMode;

      if (mode === "pvp_staked" || mode === "vs_ai_staked") {
        // Staked flows: player has already signed a stake/create_game tx;
        // we submit the XDR before minting a session.
        if (!payload.signedXdr || !payload.asset) {
          return ack({ error: "signedXdr + asset required for staked modes" });
        }
        if (!services.assets.isSupported(payload.asset)) {
          return ack({ error: `Unsupported asset: ${payload.asset}` });
        }
        await services.stellar.submitSignedTransaction(payload.signedXdr);
      }

      const gameId = uuidv4();
      const stakeStroops =
        payload.stakeStroops !== undefined ? Number(BigInt(payload.stakeStroops)) : 0;

      const state = createInitialState({
        gameId,
        mode,
        playerOne: walletAddress,
        stakeAmount: stakeStroops,
        stakeAsset: payload.asset,
      });

      // vs-AI is turn-based: both sides have codes. The Vault's code is
      // generated server-side; the player sets theirs in the next step.
      if (mode === "vs_ai_free" || mode === "vs_ai_staked") {
        state.playerTwo = "vault";
        state.status = "setting_codes";
        const vaultCode = services.ai.generateVaultCode();
        await services.gameStore.setVaultCode(gameId, vaultCode);
        state.playerTwoCode = "set"; // marker — actual code stored separately
      }

      await services.gameStore.save(state);
      await services.gameStore.setActiveGame(walletAddress, gameId);

      socket.join(gameId);
      socket.data.gameIds.add(gameId);
      socket.data.walletAddress = walletAddress;

      const inviteCode = gameId.slice(-6).toUpperCase();
      await services.gameStore.bindInvite(inviteCode, gameId);
      socket.emit("game_created", { gameId, inviteCode });

      // For vs-AI, there's no opponent to wait for — send the initial
      // view now so the client transitions straight to the board.
      if (mode === "vs_ai_free" || mode === "vs_ai_staked") {
        socket.emit("game_started", {
          gameId,
          playerOne: walletAddress,
          playerTwo: "vault",
          view: buildView(state, "playerOne"),
        });
      }
      ack({ gameId, inviteCode });
    } catch (err) {
      logger.error({ err }, "create_game failed");
      ack({ error: errorMessage(err) });
    }
  });

  // ---------- join_game ----------
  socket.on("join_game", async (payload, ack) => {
    try {
      const walletAddress = walletSchema.parse(payload.walletAddress);
      const state = await services.gameStore.load(payload.gameId);
      if (!state) return ack({ ok: false, error: "game not found" });

      // vs-AI games can't be joined — they're single-player.
      if (state.mode === "vs_ai_free" || state.mode === "vs_ai_staked") {
        return ack({ ok: false, error: "AI games can't be joined" });
      }
      if (state.status !== "lobby") {
        return ack({ ok: false, error: "game not accepting joins" });
      }
      if (state.playerOne === walletAddress) {
        return ack({ ok: false, error: "cannot join your own game" });
      }

      // Staked PvP: submit the player's signed join_game tx on-chain.
      if (state.mode === "pvp_staked") {
        if (!payload.signedXdr) {
          return ack({ ok: false, error: "signedXdr required for staked PvP" });
        }
        await services.stellar.submitSignedTransaction(payload.signedXdr);
      }

      state.playerTwo = walletAddress;
      state.status = "setting_codes";

      // Stellar Game Studio Hub: record match start (best-effort).
      if (state.mode === "pvp_casual" || state.mode === "pvp_staked") {
        const sessionId = await services.gameStore.nextHubSessionId();
        state.hubSessionId = sessionId;
        void services.stellar.hubStartGame(sessionId, state.playerOne, walletAddress);
      }

      await services.gameStore.save(state);
      await services.gameStore.setActiveGame(walletAddress, payload.gameId);

      socket.join(payload.gameId);
      socket.data.gameIds.add(payload.gameId);
      socket.data.walletAddress = walletAddress;

      const view = buildView(state, "playerTwo");
      io.to(payload.gameId).emit("game_started", {
        gameId: payload.gameId,
        playerOne: state.playerOne,
        playerTwo: walletAddress,
        view,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error({ err }, "join_game failed");
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  // ---------- set_code ----------
  socket.on("set_code", async (payload, ack) => {
    try {
      walletSchema.parse(payload.walletAddress);
      if (!validateCode(payload.code)) {
        return ack({ ok: false, error: `code must be ${CODE_LENGTH} distinct digits` });
      }
      const state = await services.gameStore.load(payload.gameId);
      if (!state) return ack({ ok: false, error: "game not found" });
      if (state.status !== "setting_codes") {
        return ack({ ok: false, error: "not in code-setting phase" });
      }
      const slot = slotFor(state, payload.walletAddress);
      if (!slot) return ack({ ok: false, error: "not a player in this game" });

      if (slot === "playerOne") state.playerOneCode = payload.code;
      else state.playerTwoCode = payload.code;

      const bothSet = !!state.playerOneCode && !!state.playerTwoCode;
      if (bothSet) state.status = "active";

      await services.gameStore.save(state);

      // Push each socket its own view (each player only sees their own
      // secret) so the client can render the active board immediately.
      const sockets = await io.in(payload.gameId).fetchSockets();
      for (const s of sockets) {
        const wallet = s.data.walletAddress;
        if (!wallet) continue;
        const theirSlot = slotFor(state, wallet);
        if (!theirSlot) continue;
        s.emit("codes_set", {
          gameId: payload.gameId,
          view: buildView(state, theirSlot),
        });
      }
      ack({ ok: true });
    } catch (err) {
      logger.error({ err }, "set_code failed");
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  // ---------- make_guess ----------
  socket.on("make_guess", async (payload, ack) => {
    try {
      walletSchema.parse(payload.walletAddress);
      if (!validateCode(payload.guess)) {
        return ack({ ok: false, error: "invalid guess format" });
      }
      const state = await services.gameStore.load(payload.gameId);
      if (!state) return ack({ ok: false, error: "game not found" });
      if (state.status !== "active") {
        return ack({ ok: false, error: "game not active" });
      }
      const slot = slotFor(state, payload.walletAddress);
      if (!slot) return ack({ ok: false, error: "not a player in this game" });
      if (state.currentTurn !== slot) {
        return ack({ ok: false, error: "not your turn" });
      }

      const secret = await secretForOpponent(state, slot, services);
      if (!secret) return ack({ ok: false, error: "opponent code not set" });

      const result = computeGuessResult(secret, payload.guess);
      const guess = {
        code: payload.guess,
        result,
        timestamp: Date.now(),
      };
      if (slot === "playerOne") state.playerOneGuesses.push(guess);
      else state.playerTwoGuesses.push(guess);

      // Flip turn (vs-AI: after this emit, the AI takes its turn below).
      state.currentTurn = otherSlot(slot);

      const finished = checkGameOver(state);
      if (finished) {
        state.status = "finished";
        state.winner = finished.winner;
        state.isDraw = finished.isDraw;
      }

      await services.gameStore.save(state);

      // Broadcast the human's guess to the room.
      const guessEvent: S2CGuessResult = {
        guesser: slot,
        guess: payload.guess,
        result,
        nextTurn: state.currentTurn,
        view: buildView(state, slot),
      };
      io.to(payload.gameId).emit("guess_result", guessEvent);
      ack({ ok: true });

      if (finished) {
        await resolveFinished(io, services, state, finished);
        return;
      }

      // vs-AI: The Vault takes its turn against the player's code.
      if (state.mode === "vs_ai_free" || state.mode === "vs_ai_staked") {
        await takeAiTurn(io, services, state);
      }
    } catch (err) {
      logger.error({ err }, "make_guess failed");
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  // ---------- send_chat ----------
  socket.on("send_chat", async (payload) => {
    try {
      const walletAddress = walletSchema.parse(payload.walletAddress);
      const message = String(payload.message).slice(0, 200).trim();
      if (!message) return;
      const now = Date.now();
      if (now - socket.data.lastChatAt < services.cfg.CHAT_RATE_LIMIT_MS) return;
      socket.data.lastChatAt = now;

      const state = await services.gameStore.load(payload.gameId);
      if (!state) return;
      if (!slotFor(state, walletAddress)) return;

      io.to(payload.gameId).emit("chat_message", {
        sender: shortAddress(walletAddress),
        wallet: walletAddress,
        message,
        timestamp: now,
      });
    } catch {
      // chat is best-effort; ignore malformed payloads
    }
  });

  // ---------- cancel_game ----------
  socket.on("cancel_game", async (payload, ack) => {
    try {
      const walletAddress = walletSchema.parse(payload.walletAddress);
      const state = await services.gameStore.load(payload.gameId);
      if (!state) return ack({ ok: false, error: "game not found" });
      if (state.playerOne !== walletAddress) {
        return ack({ ok: false, error: "only player one can cancel" });
      }
      if (state.status !== "lobby") {
        return ack({ ok: false, error: "game no longer cancellable" });
      }
      state.status = "cancelled";
      await services.gameStore.save(state);
      io.to(payload.gameId).emit("opponent_left", { gameId: payload.gameId });
      ack({ ok: true });
    } catch (err) {
      ack({ ok: false, error: errorMessage(err) });
    }
  });

  // ---------- disconnect ----------
  socket.on("disconnect", async () => {
    for (const gameId of socket.data.gameIds) {
      io.to(gameId).emit("opponent_left", { gameId });
    }
  });
}

// ---------------------------- helpers ----------------------------

function errorMessage(err: unknown): string {
  if (err instanceof z.ZodError) return "invalid payload";
  if (err instanceof Error) return err.message;
  return "unknown error";
}

function slotFor(state: GameState, wallet: string): PlayerSlot | null {
  if (state.playerOne === wallet) return "playerOne";
  if (state.playerTwo === wallet) return "playerTwo";
  return null;
}

async function secretForOpponent(
  state: GameState,
  slot: PlayerSlot,
  services: Services,
): Promise<string | null> {
  // The secret the current player is guessing against = opponent's code.
  if (slot === "playerOne") {
    if (state.mode === "vs_ai_free" || state.mode === "vs_ai_staked") {
      return await services.gameStore.getVaultCode(state.gameId);
    }
    return state.playerTwoCode ?? null;
  }
  return state.playerOneCode ?? null;
}

function buildView(state: GameState, slot: PlayerSlot): SafeGameView {
  const redacted = redactForPlayer(state, slot);
  return {
    gameId: state.gameId,
    mode: state.mode,
    status: state.status,
    you: slot,
    youAre: slot === "playerOne" ? state.playerOne : state.playerTwo ?? "",
    opponent: slot === "playerOne" ? state.playerTwo : state.playerOne,
    yourCode: redacted.yourCode,
    opponentCodeSet: redacted.opponentCodeSet,
    yourGuesses: redacted.yourGuesses,
    opponentGuesses: redacted.opponentGuesses,
    currentTurn: state.currentTurn,
    winner: state.winner,
    isDraw: state.isDraw,
    stakeAmount: state.stakeAmount,
    maxGuesses: state.maxGuesses,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

/**
 * After a human guess pushes us to game-over, or after the AI wins, call
 * the appropriate on-chain settlement + Hub notification.
 */
async function resolveFinished(
  io: CrackdServer,
  services: Services,
  state: GameState,
  outcome: { winner: string | null; isDraw: boolean; winningSlot: PlayerSlot | null },
): Promise<void> {
  let payoutTxHash: string | undefined;

  try {
    if (state.mode === "vs_ai_staked" && state.stakeAsset) {
      // Winner was the human → resolve_win. Loss → resolve_loss.
      if (outcome.winningSlot === "playerOne") {
        const { txHash } = await services.stellar.resolveWin(
          state.playerOne,
          state.stakeAsset,
          BigInt(state.stakeAmount || 0),
          state.playerOneGuesses.length,
        );
        payoutTxHash = txHash;
      } else {
        await services.stellar.resolveLoss(state.playerOne);
      }
    } else if (state.mode === "pvp_staked" && state.contractGameId) {
      if (outcome.isDraw) {
        payoutTxHash = await services.stellar.declareDuelDraw(state.contractGameId);
      } else if (outcome.winner) {
        payoutTxHash = await services.stellar.declareDuelWinner(
          state.contractGameId,
          outcome.winner,
        );
      }
    }
  } catch (err) {
    logger.error({ err, gameId: state.gameId }, "on-chain resolution failed");
  }

  // Stellar Game Studio Hub: end-of-match (PvP only).
  if (state.hubSessionId && (state.mode === "pvp_casual" || state.mode === "pvp_staked")) {
    const p1Won = outcome.winningSlot === "playerOne";
    void services.stellar.hubEndGame(state.hubSessionId, p1Won);
  }

  const vaultCode =
    state.mode === "vs_ai_free" || state.mode === "vs_ai_staked"
      ? (await services.gameStore.getVaultCode(state.gameId)) ?? ""
      : "";

  const over: S2CGameOver = {
    gameId: state.gameId,
    winner: outcome.winner,
    isDraw: outcome.isDraw,
    contractGameId: state.contractGameId,
    ...(payoutTxHash ? { payoutTxHash } : {}),
    final: {
      playerOneCode: state.playerOneCode ?? "",
      playerTwoCode:
        state.mode === "vs_ai_free" || state.mode === "vs_ai_staked"
          ? vaultCode
          : state.playerTwoCode ?? "",
      playerOneGuesses: state.playerOneGuesses.map((g) => ({
        code: g.code,
        result: g.result,
      })),
      playerTwoGuesses: state.playerTwoGuesses.map((g) => ({
        code: g.code,
        result: g.result,
      })),
    },
  };
  io.to(state.gameId).emit("game_over", over);
}

/**
 * vs-AI follow-up: The Vault takes its turn against the human's code,
 * then fires a Pidgin taunt. Fires a short think-time delay so the
 * frontend can render the "opponent's turn" state — makes the back-and-
 * forth feel like an actual match, not instant pong.
 */
async function takeAiTurn(
  io: CrackdServer,
  services: Services,
  state: GameState,
): Promise<void> {
  const humanCode = state.playerOneCode;
  if (!humanCode) return;

  const aiPrior = state.playerTwoGuesses.map((g) => g.code);
  const feedback = state.playerTwoGuesses.map((g) => g.result);

  // Small artificial delay so the "thinking…" indicator registers.
  await new Promise((r) => setTimeout(r, 900));

  const aiGuess = await services.ai.getAIGuess(aiPrior, feedback);
  const result = computeGuessResult(humanCode, aiGuess);
  state.playerTwoGuesses.push({ code: aiGuess, result, timestamp: Date.now() });
  state.currentTurn = "playerOne";

  const finished = checkGameOver(state);
  if (finished) {
    state.status = "finished";
    state.winner = finished.winner;
    state.isDraw = finished.isDraw;
  }

  await services.gameStore.save(state);

  io.to(state.gameId).emit("guess_result", {
    guesser: "playerTwo",
    guess: aiGuess,
    result,
    nextTurn: state.currentTurn,
    view: buildView(state, "playerOne"),
  });

  // Optional taunt (fire-and-forget).
  const tauntEvent =
    result.pots === CODE_LENGTH
      ? "ai_cracked_code"
      : result.pots >= 2
        ? "ai_good_guess"
        : "player_bad_guess";
  void services.ai
    .getPidginTrashTalk({
      event: tauntEvent,
      potsScored: result.pots,
      pansScored: result.pans,
      guessesUsed: state.playerTwoGuesses.length,
    })
    .then((message) => io.to(state.gameId).emit("vault_taunt", { message }))
    .catch(() => {});

  if (finished) {
    await resolveFinished(io, services, state, finished);
  }
}
