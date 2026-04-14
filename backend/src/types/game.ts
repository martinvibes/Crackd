/**
 * Shared game types. Mirror of frontend types — kept duplicated intentionally
 * (small, stable surface; cost of a shared package isn't justified).
 */

export type PlayerSlot = "playerOne" | "playerTwo";

export type GameMode =
  | "vs_ai_free"
  | "vs_ai_staked"
  | "pvp_casual"
  | "pvp_staked";

export type GameStatus =
  | "lobby" // player created, waiting
  | "setting_codes" // both present, setting secrets
  | "active" // both codes set, taking turns
  | "finished"
  | "cancelled";

/**
 * The game board — never send both codes to both clients until the game
 * is finished. Backend holds the authoritative state.
 */
export interface GameState {
  gameId: string;
  mode: GameMode;

  playerOne: string;          // wallet G… or socketId for anon casual
  playerTwo: string | null;   // null in lobby

  /** Secret codes. `undefined` until player sets them. */
  playerOneCode?: string;
  playerTwoCode?: string;

  playerOneGuesses: Guess[];
  playerTwoGuesses: Guess[];

  currentTurn: PlayerSlot;
  status: GameStatus;
  winner: string | null;      // wallet address or "vault" for AI wins
  isDraw: boolean;

  stakeAmount: number;        // stroops; 0 for free/casual
  contractGameId: string | null; // BytesN<32> hex for on-chain duel; null otherwise

  maxGuesses: number;         // hard ceiling, default 10

  createdAt: number;          // ms since epoch
  updatedAt: number;
}

export interface GuessResult {
  /** Correct digit AND correct position. */
  pots: number;
  /** Correct digit, wrong position. */
  pans: number;
}

export interface Guess {
  code: string;
  result: GuessResult;
  timestamp: number;
}

/**
 * The redacted view sent to a specific client — never exposes the
 * opponent's code or the AI's code.
 */
export interface SafeGameView {
  gameId: string;
  mode: GameMode;
  status: GameStatus;
  you: PlayerSlot;
  youAre: string;
  opponent: string | null;
  yourCode?: string;          // your own code echoed back after setting
  opponentCodeSet: boolean;   // bool only — never the code itself
  yourGuesses: Guess[];
  opponentGuesses: Omit<Guess, "code">[]; // result only; opponent's guess strings shown
  currentTurn: PlayerSlot;
  winner: string | null;
  isDraw: boolean;
  stakeAmount: number;
  maxGuesses: number;
  createdAt: number;
  updatedAt: number;
}
