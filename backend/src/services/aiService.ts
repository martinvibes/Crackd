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
import { CODE_LENGTH, validateCode } from "./gameLogic.js";
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
   * Ask Claude for The Vault's next guess against the player's code.
   *
   * We feed it:
   *  - the AI's prior guesses
   *  - the feedback it received on each
   * and ask it to deduce. Model must return EXACTLY a 4-digit string.
   *
   * Fallback if Claude fails: first valid code not previously tried.
   */
  async getAIGuess(
    aiPreviousGuesses: string[],
    playerFeedback: GuessResult[],
  ): Promise<string> {
    if (!this.client) return fallbackGuess(aiPreviousGuesses);

    const prompt = buildGuessPrompt(aiPreviousGuesses, playerFeedback);
    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 50,
        system:
          "You are a code-breaking solver. You output only a single 4-digit code with no repeats. No explanation, no prose, nothing else.",
        messages: [{ role: "user", content: prompt }],
      });
      const text = extractText(resp).trim();
      const match = text.match(/\b\d{4}\b/);
      const code = match?.[0] ?? "";
      if (!validateCode(code) || aiPreviousGuesses.includes(code)) {
        logger.warn(
          { text, code, previous: aiPreviousGuesses },
          "AI guess invalid or repeated; falling back",
        );
        return fallbackGuess(aiPreviousGuesses);
      }
      return code;
    } catch (err) {
      logger.error({ err }, "AI guess call failed; falling back");
      return fallbackGuess(aiPreviousGuesses);
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

function buildGuessPrompt(
  aiPreviousGuesses: string[],
  playerFeedback: GuessResult[],
): string {
  const rounds = aiPreviousGuesses.map(
    (g, i) =>
      `Guess ${i + 1}: ${g} → ${playerFeedback[i]?.pots ?? 0} pots, ${
        playerFeedback[i]?.pans ?? 0
      } pans`,
  );
  return [
    "You are guessing a secret 4-digit code with no repeated digits (digits 0-9).",
    "Feedback per guess: POT = correct digit correct position; PAN = correct digit wrong position.",
    "",
    "Previous rounds:",
    rounds.length ? rounds.join("\n") : "(none yet)",
    "",
    "Respond with exactly one 4-digit guess — no repeats, not one you already tried.",
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
export const __testing = { buildGuessPrompt, tauntUserPrompt, fallbackGuess };
