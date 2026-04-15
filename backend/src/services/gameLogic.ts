/**
 * Pure game logic — no side effects, no I/O. This is the authoritative
 * rule engine. Every guess, every win condition, every validation goes
 * through here. Anything that talks to Redis, Stellar, or Claude lives
 * elsewhere.
 *
 * Tests live in `gameLogic.test.ts`.
 */
import type { GameState, Guess, GuessResult, PlayerSlot } from "../types/game.js";

/** Default max guesses per player per game. */
export const DEFAULT_MAX_GUESSES = 10;
/** Code length — the brief says 4 digits; keep as constant for future scaling. */
export const CODE_LENGTH = 4;

/**
 * A valid Crackd code: exactly CODE_LENGTH decimal digits, no repeats.
 * e.g. "5831" OK, "5531" not OK (two 5s), "58a1" not OK.
 */
export function validateCode(code: string): boolean {
  if (typeof code !== "string") return false;
  if (code.length !== CODE_LENGTH) return false;
  if (!/^\d+$/.test(code)) return false;
  const seen = new Set<string>();
  for (const ch of code) {
    if (seen.has(ch)) return false;
    seen.add(ch);
  }
  return true;
}

/**
 * Given a secret and a guess, count "pots" (right digit right place)
 * and "pans" (right digit wrong place).
 *
 * Precondition: both are valid Crackd codes. Safe to call with invalid
 * guesses too — returns {0,0} rather than throwing, so the caller can
 * decide how to surface the failure.
 */
export function computeGuessResult(secret: string, guess: string): GuessResult {
  if (!validateCode(secret) || !validateCode(guess)) {
    return { pots: 0, pans: 0 };
  }
  let pots = 0;
  let pans = 0;
  for (let i = 0; i < CODE_LENGTH; i++) {
    const g = guess[i]!;
    if (g === secret[i]) {
      pots += 1;
    } else if (secret.includes(g)) {
      pans += 1;
    }
  }
  return { pots, pans };
}

/** A guess is a "crack" when all positions match. */
export function isCrack(result: GuessResult): boolean {
  return result.pots === CODE_LENGTH;
}

/** Count how many guesses a given player has submitted. */
export function getGuessCount(state: GameState, slot: PlayerSlot): number {
  return slot === "playerOne"
    ? state.playerOneGuesses.length
    : state.playerTwoGuesses.length;
}

export function getGuessesFor(state: GameState, slot: PlayerSlot): Guess[] {
  return slot === "playerOne" ? state.playerOneGuesses : state.playerTwoGuesses;
}

export function getPlayerAddress(state: GameState, slot: PlayerSlot): string | null {
  return slot === "playerOne" ? state.playerOne : state.playerTwo;
}

export function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === "playerOne" ? "playerTwo" : "playerOne";
}

export interface GameOutcome {
  winner: string | null;     // wallet address or "vault"
  isDraw: boolean;
  winningSlot: PlayerSlot | null;
}

/**
 * Decide whether the game is over given its current state. Called after
 * every accepted guess by the handler.
 *
 * Game-over conditions:
 * - A player fully cracked the opponent's code → they win.
 * - Both players used all maxGuesses without cracking → draw.
 * - One player used all maxGuesses while the other didn't crack either
 *   → game continues only if the other still has guesses left.
 *   If both have used all → draw (handled by the guess-count branch).
 *
 * Note: in a turn-based game these rarely tie unless both cracked on
 * matching turns. That branch is handled too.
 */
export function checkGameOver(state: GameState): GameOutcome | null {
  const p1LastGuess = state.playerOneGuesses.at(-1);
  const p2LastGuess = state.playerTwoGuesses.at(-1);
  const p1Cracked = p1LastGuess && isCrack(p1LastGuess.result);
  const p2Cracked = p2LastGuess && isCrack(p2LastGuess.result);

  // Simultaneous cracks on same-turn count — rare but possible if the
  // rules are ever expanded to simultaneous guessing. Current turn-based
  // flow can only reach here after one player cracks and the other
  // already cracked in their previous turn.
  if (p1Cracked && p2Cracked) {
    return { winner: null, isDraw: true, winningSlot: null };
  }
  if (p1Cracked) {
    return {
      winner: state.playerOne,
      isDraw: false,
      winningSlot: "playerOne",
    };
  }
  if (p2Cracked && state.playerTwo) {
    return {
      winner: state.playerTwo,
      isDraw: false,
      winningSlot: "playerTwo",
    };
  }

  const max = state.maxGuesses;
  const p1Done = state.playerOneGuesses.length >= max;
  const p2Done = state.playerTwoGuesses.length >= max;
  if (p1Done && p2Done) {
    return { winner: null, isDraw: true, winningSlot: null };
  }

  return null;
}

/**
 * Produce a redacted view of the game safe to send to a specific client.
 * Never leak the opponent's code or guess strings (only their counts and
 * feedback results).
 */
export function redactForPlayer(
  state: GameState,
  slot: PlayerSlot,
): {
  yourCode?: string;
  opponentCodeSet: boolean;
  yourGuesses: Guess[];
  opponentGuesses: Omit<Guess, "code">[];
} {
  const yourCode =
    slot === "playerOne" ? state.playerOneCode : state.playerTwoCode;
  const opponentCodeSet =
    slot === "playerOne" ? !!state.playerTwoCode : !!state.playerOneCode;
  const yourGuesses = getGuessesFor(state, slot);
  const oppGuesses = getGuessesFor(state, otherSlot(slot));

  // Show opponent's guess results but redact their guesses' code string
  // only while the game is live — once finished, everything's revealed.
  const finished = state.status === "finished";
  const opponentGuesses = oppGuesses.map<Omit<Guess, "code"> & { code?: string }>(
    (g) => (finished ? { ...g } : { result: g.result, timestamp: g.timestamp }),
  );

  return { yourCode, opponentCodeSet, yourGuesses, opponentGuesses };
}

/**
 * Factory for a fresh game state. Pure; caller decides where to store it.
 */
export function createInitialState(params: {
  gameId: string;
  mode: GameState["mode"];
  playerOne: string;
  stakeAmount?: number;
  stakeAsset?: string;
  contractGameId?: string | null;
  hubSessionId?: number | null;
  maxGuesses?: number;
}): GameState {
  const now = Date.now();
  return {
    gameId: params.gameId,
    mode: params.mode,
    playerOne: params.playerOne,
    playerTwo: null,
    playerOneGuesses: [],
    playerTwoGuesses: [],
    currentTurn: "playerOne",
    status: "lobby",
    winner: null,
    isDraw: false,
    stakeAmount: params.stakeAmount ?? 0,
    stakeAsset: params.stakeAsset,
    contractGameId: params.contractGameId ?? null,
    hubSessionId: params.hubSessionId ?? null,
    maxGuesses: params.maxGuesses ?? DEFAULT_MAX_GUESSES,
    createdAt: now,
    updatedAt: now,
  };
}
