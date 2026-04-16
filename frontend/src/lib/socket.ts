/**
 * Socket.io client singleton.
 *
 * We intentionally keep a single connection per tab. Multiple page
 * components can attach listeners without re-opening a connection.
 */
import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

// Event types mirrored from backend — kept in sync manually (small surface,
// and the cost of a shared package isn't justified for this.)
export interface GuessResult {
  pots: number;
  pans: number;
}

export interface S2CGameCreated {
  gameId: string;
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
  view: SafeGameView;
}

export interface SafeGameView {
  gameId: string;
  mode: string;
  status: string;
  you: "playerOne" | "playerTwo";
  youAre: string;
  opponent: string | null;
  yourCode?: string;
  opponentCodeSet: boolean;
  yourGuesses: Array<{ code: string; result: GuessResult; timestamp: number }>;
  opponentGuesses: Array<{ code?: string; result: GuessResult; timestamp: number }>;
  currentTurn: "playerOne" | "playerTwo";
  winner: string | null;
  isDraw: boolean;
  stakeAmount: number;
  maxGuesses: number;
  createdAt: number;
  updatedAt: number;
}

export interface S2CGuessResult {
  guesser: "playerOne" | "playerTwo";
  guess: string;
  result: GuessResult;
  nextTurn: "playerOne" | "playerTwo";
  view: SafeGameView;
}

export interface S2CGameOver {
  gameId: string;
  winner: string | null;
  isDraw: boolean;
  contractGameId: string | null;
  payoutTxHash?: string;
  /** Bonus the winner received from the pool, in whole units (e.g. XLM). */
  payoutAmount?: number;
  payoutAsset?: string;
  /** The winner's original stake, whole units. */
  stakeAmount?: number;
  final: {
    playerOneCode: string;
    playerTwoCode: string;
    playerOneGuesses: Array<{ code: string; result: GuessResult }>;
    playerTwoGuesses: Array<{ code: string; result: GuessResult }>;
  };
}

export interface S2CChatMessage {
  sender: string;
  wallet: string;
  message: string;
  timestamp: number;
}

export interface S2CVaultTaunt {
  message: string;
}

// ---- client singleton ----

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
