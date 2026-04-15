/**
 * Wallet state. Kept separate from game state because they have
 * different lifecycles — wallet persists across games, game state
 * belongs to a single session.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { kit, connectWallet } from "../lib/wallet";

interface WalletState {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  restore: () => Promise<void>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      connecting: false,
      connect: async () => {
        if (get().connecting) return;
        set({ connecting: true });
        try {
          const address = await connectWallet();
          set({ address, connecting: false });
        } catch (err) {
          set({ connecting: false });
          throw err;
        }
      },
      disconnect: () => {
        kit.disconnect().catch(() => {});
        set({ address: null });
      },
      restore: async () => {
        // If localStorage says we were connected, try to silently reconnect.
        const addr = get().address;
        if (!addr) return;
        try {
          const { address } = await kit.getAddress();
          if (address && address !== addr) set({ address });
        } catch {
          // User revoked — clear state.
          set({ address: null });
        }
      },
    }),
    {
      name: "crackd-wallet",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ address: s.address }),
    },
  ),
);
