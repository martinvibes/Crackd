/**
 * Game REST routes. The bulk of real-time gameplay happens over Socket.io
 * (Phase 3); these endpoints cover the lifecycle entry points that have
 * to do synchronous XDR work (staking tx submission) or read a game's
 * summary for the share card / post-game replay.
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { Services } from "../services/services.js";
import {
  createInitialState,
  redactForPlayer,
} from "../services/gameLogic.js";
import { stroopsToXlm } from "../utils/units.js";

const stakeBody = z.object({
  walletAddress: z.string().startsWith("G").length(56),
  signedXdr: z.string().min(100),
});

export function gameRouter(services: Services): Router {
  const r = Router();

  /**
   * Sanitised read of a game (no secret codes until finished).
   * Used by the post-game replay / share card.
   */
  r.get("/game/:gameId", async (req, res, next) => {
    try {
      const state = await services.gameStore.load(req.params.gameId);
      if (!state) {
        res.status(404).json({ error: "game not found" });
        return;
      }
      // Send neutral view — "playerOne" perspective with redaction.
      const view = redactForPlayer(state, "playerOne");
      res.json({
        gameId: state.gameId,
        mode: state.mode,
        status: state.status,
        playerOne: state.playerOne,
        playerTwo: state.playerTwo,
        currentTurn: state.currentTurn,
        winner: state.winner,
        isDraw: state.isDraw,
        maxGuesses: state.maxGuesses,
        stakeXlm: stroopsToXlm(BigInt(state.stakeAmount)),
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        playerOneGuessCount: state.playerOneGuesses.length,
        playerTwoGuessCount: state.playerTwoGuesses.length,
        // Full codes revealed only once game is over.
        revealed:
          state.status === "finished"
            ? {
                playerOneCode: state.playerOneCode,
                playerTwoCode: state.playerTwoCode,
                playerOneGuesses: state.playerOneGuesses,
                playerTwoGuesses: state.playerTwoGuesses,
              }
            : null,
        view,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Stake vs AI: player has signed a `stake(player, amount)` tx on the
   * frontend. Backend submits it, then creates an AI game session.
   */
  r.post("/game/stake-vs-ai", async (req, res, next) => {
    try {
      const { walletAddress, signedXdr } = stakeBody.parse(req.body);

      // Submit player's signed stake tx to Soroban.
      const txHash = await services.stellar.submitSignedTransaction(signedXdr);

      // Create a game session + set The Vault's code.
      const gameId = uuidv4();
      const state = createInitialState({
        gameId,
        mode: "vs_ai_staked",
        playerOne: walletAddress,
        // stakeAmount is authoritative on-chain; we track it via the AI
        // orchestrator when the game resolves. For the session blob we
        // leave 0 to avoid drift with on-chain source of truth.
        stakeAmount: 0,
      });
      // Mark AI as "present" so the lobby → setting_codes transition goes
      // through immediately on the socket handler side.
      state.playerTwo = "vault";
      state.status = "setting_codes";

      const vaultCode = services.ai.generateVaultCode();
      await services.gameStore.setVaultCode(gameId, vaultCode);
      await services.gameStore.save(state);
      await services.gameStore.setActiveGame(walletAddress, gameId);

      res.json({ gameId, txHash });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  return r;
}
