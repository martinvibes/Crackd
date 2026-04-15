/**
 * Active game state. The authoritative copy is the backend — this store
 * mirrors what we've received via socket events so the UI can render.
 */
import { create } from "zustand";
import type {
  SafeGameView,
  S2CChatMessage,
  S2CGameOver,
} from "../lib/socket";

interface GameState {
  view: SafeGameView | null;
  chat: S2CChatMessage[];
  tauntLine: string | null;
  finished: S2CGameOver | null;
  setView: (v: SafeGameView | null) => void;
  addChat: (m: S2CChatMessage) => void;
  setTaunt: (line: string | null) => void;
  setFinished: (e: S2CGameOver | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  view: null,
  chat: [],
  tauntLine: null,
  finished: null,
  setView: (view) => set({ view }),
  addChat: (m) => set((s) => ({ chat: [...s.chat.slice(-49), m] })),
  setTaunt: (tauntLine) => set({ tauntLine }),
  setFinished: (finished) => set({ finished }),
  reset: () => set({ view: null, chat: [], tauntLine: null, finished: null }),
}));
