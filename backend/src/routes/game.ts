/**
 * Game REST routes. Socket.io (Phase 3) owns real-time play; these endpoints
 * cover the lifecycle entry points that need synchronous XDR work (staking
 * submission) or summary reads for replay / share card.
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { Services } from "../services/services.js";
import { createInitialState, redactForPlayer } from "../services/gameLogic.js";
import { stroopsToXlm } from "../utils/units.js";

const stakeBody = z.object({
  walletAddress: z.string().startsWith("G").length(56),
  asset: z.string().min(3),
  signedXdr: z.string().min(100),
});

export function gameRouter(services: Services): Router {
  const r = Router();

  /**
   * GET /api/invite/:code — resolve a short invite code (like "5DA70B")
   * into a full gameId so the joiner doesn't need to paste the uuid.
   */
  r.get("/invite/:code", async (req, res, next) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        res.status(400).json({ error: "Invalid invite code" });
        return;
      }
      const gameId = await services.gameStore.resolveInvite(code);
      if (!gameId) {
        res.status(404).json({ error: "Invite not found" });
        return;
      }
      res.json({ gameId });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/game/:gameId — sanitised read for replay / share card.
   */
  r.get("/game/:gameId", async (req, res, next) => {
    try {
      const state = await services.gameStore.load(req.params.gameId);
      if (!state) {
        res.status(404).json({ error: "game not found" });
        return;
      }
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
        stake: stroopsToXlm(BigInt(state.stakeAmount)),
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        playerOneGuessCount: state.playerOneGuesses.length,
        playerTwoGuessCount: state.playerTwoGuesses.length,
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
   * POST /api/game/stake-vs-ai
   *
   * Body: { walletAddress, asset, signedXdr }
   *
   * Flow: frontend builds a `stake(player, token, amount)` call against
   * the vault contract, signs it via the wallet kit, posts the XDR here.
   * We submit it, then spin up an AI game session.
   */
  r.post("/game/stake-vs-ai", async (req, res, next) => {
    try {
      const { walletAddress, asset, signedXdr } = stakeBody.parse(req.body);
      if (!services.assets.isSupported(asset)) {
        res.status(400).json({ error: `Unsupported asset: ${asset}` });
        return;
      }

      const txHash = await services.stellar.submitSignedTransaction(signedXdr);

      const gameId = uuidv4();
      const state = createInitialState({
        gameId,
        mode: "vs_ai_staked",
        playerOne: walletAddress,
      });
      state.playerTwo = "vault";
      state.status = "setting_codes";

      const vaultCode = services.ai.generateVaultCode();
      await services.gameStore.setVaultCode(gameId, vaultCode);
      await services.gameStore.save(state);
      await services.gameStore.setActiveGame(walletAddress, gameId);

      res.json({ gameId, asset, txHash });
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
