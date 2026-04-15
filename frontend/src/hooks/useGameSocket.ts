/**
 * Wire socket events → Zustand store. Keeping this in one hook means
 * Game.tsx just reads from the store and fires commands, no listeners.
 */
import { useEffect } from "react";
import { getSocket } from "../lib/socket";
import type {
  S2CChatMessage,
  S2CGameOver,
  S2CGameStarted,
  S2CGuessResult,
  S2CVaultTaunt,
  SafeGameView,
} from "../lib/socket";
import { useGameStore } from "../store/gameStore";

export function useGameSocket() {
  const setView = useGameStore((s) => s.setView);
  const addChat = useGameStore((s) => s.addChat);
  const setTaunt = useGameStore((s) => s.setTaunt);
  const setFinished = useGameStore((s) => s.setFinished);

  useEffect(() => {
    const socket = getSocket();

    const onStarted = (e: S2CGameStarted) => setView(e.view);
    const onGuess = (e: S2CGuessResult) => setView(e.view);
    const onCodesSet = () => {
      // trigger a view refresh via server — server will re-send on next guess
    };
    const onOver = (e: S2CGameOver) => setFinished(e);
    const onChat = (m: S2CChatMessage) => addChat(m);
    const onTaunt = (t: S2CVaultTaunt) => {
      setTaunt(t.message);
      setTimeout(() => setTaunt(null), 6000);
    };
    const onError = (e: { message: string }) => console.error("socket error:", e);

    socket.on("game_started", onStarted);
    socket.on("guess_result", onGuess);
    socket.on("codes_set", onCodesSet);
    socket.on("game_over", onOver);
    socket.on("chat_message", onChat);
    socket.on("vault_taunt", onTaunt);
    socket.on("error", onError);

    return () => {
      socket.off("game_started", onStarted);
      socket.off("guess_result", onGuess);
      socket.off("codes_set", onCodesSet);
      socket.off("game_over", onOver);
      socket.off("chat_message", onChat);
      socket.off("vault_taunt", onTaunt);
      socket.off("error", onError);
    };
  }, [setView, addChat, setTaunt, setFinished]);
}

// --- emit helpers (typed) ---

export function emit<R = unknown>(
  event: string,
  payload: unknown,
): Promise<R> {
  return new Promise((resolve) => {
    getSocket().emit(event, payload, resolve as never);
  });
}

/** Emits `create_game` and returns the ack payload. */
export async function emitCreateGame(args: {
  walletAddress: string;
  mode: string;
  asset?: string;
  stakeStroops?: string;
  signedXdr?: string;
}): Promise<{ gameId?: string; error?: string }> {
  return emit<{ gameId?: string; error?: string }>("create_game", args);
}

export async function emitJoinGame(args: {
  gameId: string;
  walletAddress: string;
  signedXdr?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return emit<{ ok: boolean; error?: string }>("join_game", args);
}

export async function emitSetCode(args: {
  gameId: string;
  walletAddress: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  return emit<{ ok: boolean; error?: string }>("set_code", args);
}

export async function emitMakeGuess(args: {
  gameId: string;
  walletAddress: string;
  guess: string;
}): Promise<{ ok: boolean; error?: string }> {
  return emit<{ ok: boolean; error?: string }>("make_guess", args);
}

export async function emitCancelGame(args: {
  gameId: string;
  walletAddress: string;
}): Promise<{ ok: boolean; error?: string }> {
  return emit<{ ok: boolean; error?: string }>("cancel_game", args);
}

export function emitChat(args: {
  gameId: string;
  walletAddress: string;
  message: string;
}): void {
  getSocket().emit("send_chat", args);
}

export type ClientCodeView = SafeGameView;
