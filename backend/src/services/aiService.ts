/**
 * The Vault — Claude-powered AI opponent and Pidgin trash-talker.
 *
 * Split into two responsibilities:
 *  - guessing: picks the AI's next guess by feeding Claude the elimination
 *    state so far.
 *  - trash talk: produces a short Pidgin taunt keyed on the current game
 *    event. Kept terse and stateless so it's cheap and cacheable.
 *
 * All calls go through a single Anthropic client instance with sensible
 * timeouts; network failures fall back to deterministic defaults so a
 * game never stalls because Claude is slow.
 */
import Anthropic from "@anthropic-ai/sdk";
import { randomInt } from "node:crypto";
import type { AppConfig } from "../config.js";
import { CODE_LENGTH, computeGuessResult, validateCode } from "./gameLogic.js";
import type { Guess, GuessResult } from "../types/game.js";
import { logger } from "../utils/logger.js";

// ---------------- Pidgin trash talk ----------------

export type TauntEvent =
  | "game_start"
  | "player_bad_guess"
  | "player_good_guess"
  | "player_cracked_code"
  | "ai_good_guess"
  | "ai_cracked_code"
  | "player_losing";

export interface TauntContext {
  event: TauntEvent;
  potsScored?: number;
  pansScored?: number;
  guessesUsed?: number;
  playerIsClose?: boolean;
}

const FALLBACK_TAUNTS: Record<TauntEvent, string[]> = {
  game_start: [
    "Omo, The Vault dey wait. Bring your best guess abeg.",
    "See who wan try crack The Vault today? We go see.",
  ],
  player_bad_guess: [
    "E be like say you dey guess with your eye closed!",
    "Chai! That guess weak well well.",
    "No waste my time abeg, think am proper.",
  ],
  player_good_guess: [
    "Hmm, you dey try small — but The Vault never shake.",
    "Oya nah, at least you dey think now.",
  ],
  player_cracked_code: [
    "Congrats abeg, you crack am. But next round, The Vault go collect!",
    "Shebi you win this one. No get mind, we go rematch.",
  ],
  ai_good_guess: [
    "The Vault dey cook. Your code no go last.",
    "I dey close. Sweat am, my guy.",
  ],
  ai_cracked_code: [
    "Crackd! The Vault no dey miss.",
    "I don enter your code. Try me again if you get liver.",
  ],
  player_losing: [
    "You don use many guesses and still dey roam. Rest abeg.",
    "Omo, time dey go. You sure say you know wetin you dey do?",
  ],
};

export class AIService {
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(cfg: AppConfig) {
    this.model = cfg.CLAUDE_MODEL;
    this.maxTokens = cfg.CLAUDE_MAX_TOKENS;
    // Empty key → operate in fallback-only mode (useful for local dev
    // before the operator has added a key).
    this.client = cfg.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY })
      : null;
  }

  /**
   * Generate a fresh 4-digit code for The Vault. No repeats, crypto-random.
   */
  generateVaultCode(): string {
    const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    // Fisher–Yates shuffle using crypto.randomInt for unbiased picking.
    for (let i = digits.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      const a = digits[i]!;
      const b = digits[j]!;
      digits[i] = b;
      digits[j] = a;
    }
    return digits.slice(0, CODE_LENGTH).join("");
  }

  /**
   * Hybrid guesser:
   *   1. Code filters the 5040-candidate space to those still consistent
   *      with every prior (guess, feedback) pair → guarantees validity.
   *   2. Claude picks WHICH surviving candidate to actually guess →
   *      strategy + personality. An LLM is good at "pick one of these",
   *      much less reliable at combinatorial deduction alone.
   *
   * This way we get correctness (no hallucinated digits) + the AI brand
   * (Claude genuinely plays) — instead of either extreme.
   */
  async getAIGuess(
    aiPreviousGuesses: string[],
    playerFeedback: GuessResult[],
  ): Promise<string> {
    // Opening move: always a well-balanced spread. Deterministic.
    if (aiPreviousGuesses.length === 0) return "1234";

    const candidates = filterCandidates(aiPreviousGuesses, playerFeedback);
    if (candidates.length === 0) return fallbackGuess(aiPreviousGuesses);
    if (candidates.length === 1) return candidates[0]!; // only one possible code — slam-dunk.

    // Cap the list we hand Claude — keeps prompt small + cheap.
    const shortlist = candidates.slice(0, 8);

    if (!this.client) {
      // No API key configured — pick randomly from the valid set.
      return shortlist[randomInt(0, shortlist.length)]!;
    }

    const prompt = buildStrategicPrompt(
      aiPreviousGuesses,
      playerFeedback,
      shortlist,
    );
    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 30,
        system:
          "You are The Vault playing a code-breaking game. You'll be given prior feedback and a shortlist of codes still consistent with that feedback. Pick ONE code from the shortlist that's most strategic to guess next. Output exactly the 4 digits, nothing else.",
        messages: [{ role: "user", content: prompt }],
      });
      const text = extractText(resp).trim();
      const match = text.match(/\b\d{4}\b/);
      const pick = match?.[0] ?? "";
      // Hard validation: Claude's pick MUST be a valid surviving
      // candidate. If not, fall through to random-valid — never let
      // Claude drift the AI into an invalid state.
      if (candidates.includes(pick) && !aiPreviousGuesses.includes(pick)) {
        return pick;
      }
      logger.warn(
        { text, pick, candidateCount: candidates.length },
        "Claude returned code outside shortlist; picking random valid",
      );
      return shortlist[randomInt(0, shortlist.length)]!;
    } catch (err) {
      logger.error({ err }, "AI guess call failed; picking random valid");
      return shortlist[randomInt(0, shortlist.length)]!;
    }
  }

  /**
   * Get a short Pidgin taunt for a game event. Falls back to a hardcoded
   * canned line if Claude is unavailable or slow.
   */
  async getPidginTrashTalk(ctx: TauntContext): Promise<string> {
    const fallbacks = FALLBACK_TAUNTS[ctx.event];
    const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)]!;
    if (!this.client) return fallback;

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system:
          "You are The Vault — an unbreakable AI code guardian in a competitive game called Crackd. You speak exclusively in West African Pidgin English. You are cocky, funny, and theatrical. Maximum 1-2 short sentences per taunt. Never break character. Never output quotes or punctuation beyond what a sentence needs.",
        messages: [
          {
            role: "user",
            content: tauntUserPrompt(ctx),
          },
        ],
      });
      const text = extractText(resp).trim();
      if (!text) return fallback;
      return text;
    } catch (err) {
      logger.warn({ err }, "trash-talk call failed; using fallback");
      return fallback;
    }
  }
}

// --------------------------- helpers ---------------------------

function extractText(resp: Anthropic.Messages.Message): string {
  for (const block of resp.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

/**
 * Every valid 4-digit code with distinct digits. 5040 entries, enumerated
 * once at module load so we don't rebuild it per turn.
 */
const ALL_CANDIDATES: readonly string[] = (() => {
  const out: string[] = [];
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      if (b === a) continue;
      for (let c = 0; c < 10; c++) {
        if (c === a || c === b) continue;
        for (let d = 0; d < 10; d++) {
          if (d === a || d === b || d === c) continue;
          out.push(`${a}${b}${c}${d}`);
        }
      }
    }
  }
  return out;
})();

/**
 * Keep only codes consistent with every prior (guess, feedback) pair.
 * Also strips out anything the AI already tried.
 */
function filterCandidates(
  previousGuesses: string[],
  feedback: GuessResult[],
): string[] {
  return ALL_CANDIDATES.filter((candidate) => {
    if (previousGuesses.includes(candidate)) return false;
    for (let i = 0; i < previousGuesses.length; i++) {
      const want = feedback[i];
      const prev = previousGuesses[i];
      if (!want || !prev) continue;
      const got = computeGuessResult(candidate, prev);
      if (got.pots !== want.pots || got.pans !== want.pans) return false;
    }
    return true;
  });
}

/**
 * Prompt for the hybrid picker. Gives Claude BOTH the game history
 * (so it can reason about what's known) AND the pre-filtered shortlist
 * it's allowed to pick from. Its job is strategic selection, not
 * deduction.
 */
function buildStrategicPrompt(
  aiPreviousGuesses: string[],
  playerFeedback: GuessResult[],
  shortlist: string[],
): string {
  const rounds = aiPreviousGuesses.map(
    (g, i) =>
      `  ${i + 1}. ${g}  →  ${playerFeedback[i]?.pots ?? 0} POT, ${
        playerFeedback[i]?.pans ?? 0
      } PAN`,
  );
  return [
    "You are guessing a secret 4-digit code (no repeated digits, 0-9).",
    "POT = right digit, right place. PAN = right digit, wrong place.",
    "",
    "Your guesses so far:",
    rounds.length ? rounds.join("\n") : "  (none)",
    "",
    "The codes still consistent with all the feedback above:",
    ...shortlist.map((c) => `  ${c}`),
    "",
    "Pick ONE from that shortlist. Prefer picks that split the remaining",
    "possibilities evenly (maximum info if wrong) over safer guesses.",
    "Respond with exactly 4 digits. No explanation.",
  ].join("\n");
}

function tauntUserPrompt(ctx: TauntContext): string {
  const bits: string[] = [`Event: ${ctx.event}.`];
  if (ctx.potsScored !== undefined) bits.push(`Pots scored: ${ctx.potsScored}.`);
  if (ctx.pansScored !== undefined) bits.push(`Pans scored: ${ctx.pansScored}.`);
  if (ctx.guessesUsed !== undefined) bits.push(`Guesses used: ${ctx.guessesUsed}.`);
  if (ctx.playerIsClose) bits.push(`Player is close to cracking.`);
  bits.push(`Generate one taunt (Pidgin, 1-2 sentences max).`);
  return bits.join(" ");
}

/**
 * Pick the smallest valid 4-digit code (no repeats) not yet tried.
 * Guaranteed to terminate: 10*9*8*7 = 5040 possibilities, far more than
 * any reasonable game duration.
 */
function fallbackGuess(previous: string[]): string {
  const seen = new Set(previous);
  for (let n = 123; n <= 9876; n++) {
    const s = n.toString().padStart(4, "0");
    if (!validateCode(s)) continue;
    if (!seen.has(s)) return s;
  }
  return "0123"; // should be unreachable
}

// Vitest
export const __testing = {
  buildStrategicPrompt,
  tauntUserPrompt,
  fallbackGuess,
  filterCandidates,
};
