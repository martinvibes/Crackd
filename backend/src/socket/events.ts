/**
 * Socket.io event shapes. Client and server both import these for
 * type-safe `io.emit` and `socket.on` calls.
 *
 * Conventions:
 *  - Client → Server: imperative verbs.
 *  - Server → Client: past-tense events / facts.
 */
import type { GuessResult, PlayerSlot, SafeGameView } from "../types/game.js";

// ---------- Client → Server ----------

export interface C2SCreateGame {
  walletAddress: string;
  mode: "vs_ai_free" | "pvp_casual" | "pvp_staked";
  /** Only for `pvp_staked`; player signs the `create_game` contract tx. */
  asset?: string;
  stakeStroops?: string; // string to preserve bigint precision
  signedXdr?: string;
}

export interface C2SJoinGame {
  gameId: string;
  walletAddress: string;
  /** Only for `pvp_staked`; player signs the `join_game` contract tx. */
  signedXdr?: string;
}

export interface C2SSetCode {
  gameId: string;
  walletAddress: string;
  code: string;
}

export interface C2SMakeGuess {
  gameId: string;
  walletAddress: string;
  guess: string;
}

export interface C2SCancelGame {
  gameId: string;
  walletAddress: string;
}

export interface C2SSendChat {
  gameId: string;
  walletAddress: string;
  message: string;
}

// ---------- Server → Client ----------

export interface S2CGameCreated {
  gameId: string;
  /** Short invite code shareable with an opponent; = last 6 chars of gameId. */
  inviteCode: string;
}

export interface S2CGameStarted {
  gameId: string;
  playerOne: string;
  playerTwo: string;
  view: SafeGameView;
}

export interface S2CCodesSet {
  gameId: string;
  /** Fresh view so the client can transition out of setting-codes. */
  view: SafeGameView;
}

export interface S2CGuessResult {
  guesser: PlayerSlot;
  guess: string;           // echoed back even to opponent — they see YOUR guess
  result: GuessResult;
  nextTurn: PlayerSlot;
  view: SafeGameView;
}

export interface S2CGameOver {
  gameId: string;
  winner: string | null;
  isDraw: boolean;
  /** Hex-of-contract-game-id for staked modes, else null. */
  contractGameId: string | null;
  /** Payout tx hash (staked modes only). */
  payoutTxHash?: string;
  /** Bonus amount the winner actually received from the pool, in whole
   *  units of the asset (e.g. XLM, not stroops). Only present on a
   *  staked win that triggered an on-chain resolve_win. */
  payoutAmount?: number;
  payoutAsset?: string;
  /** What the winner's stake was, echoed for the share card. */
  stakeAmount?: number;
  /** Revealed final state — codes + all guesses now visible to both. */
  final: {
    playerOneCode: string;
    playerTwoCode: string;
    playerOneGuesses: Array<{ code: string; result: GuessResult }>;
    playerTwoGuesses: Array<{ code: string; result: GuessResult }>;
  };
}

export interface S2CVaultTaunt {
  message: string;
}

export interface S2CChatMessage {
  sender: string;      // truncated wallet for display
  wallet: string;      // full wallet (for dedup)
  message: string;
  timestamp: number;
}

export interface S2COpponentLeft {
  gameId: string;
}

export interface S2CError {
  code: string;
  message: string;
  detail?: unknown;
}

// ---------- Map ----------

export interface ClientToServerEvents {
  create_game: (
    payload: C2SCreateGame,
    ack: (result: { gameId?: string; inviteCode?: string; error?: string }) => void,
  ) => void;
  join_game: (
    payload: C2SJoinGame,
    ack: (result: { ok: boolean; error?: string }) => void,
  ) => void;
  set_code: (
    payload: C2SSetCode,
    ack: (result: { ok: boolean; error?: string }) => void,
  ) => void;
  make_guess: (
    payload: C2SMakeGuess,
    ack: (result: { ok: boolean; error?: string }) => void,
  ) => void;
  cancel_game: (
    payload: C2SCancelGame,
    ack: (result: { ok: boolean; error?: string }) => void,
  ) => void;
  send_chat: (payload: C2SSendChat) => void;
}

export interface ServerToClientEvents {
  game_created: (e: S2CGameCreated) => void;
  game_started: (e: S2CGameStarted) => void;
  codes_set: (e: S2CCodesSet) => void;
  guess_result: (e: S2CGuessResult) => void;
  game_over: (e: S2CGameOver) => void;
  vault_taunt: (e: S2CVaultTaunt) => void;
  chat_message: (e: S2CChatMessage) => void;
  opponent_left: (e: S2COpponentLeft) => void;
  error: (e: S2CError) => void;
}

export type SocketData = {
  walletAddress?: string;
  gameIds: Set<string>;
  lastChatAt: number;
};
