/**
 * Wallet state. Kept separate from game state because they have
 * different lifecycles — wallet persists across games, game state
 * belongs to a single session.
 *
 * `kind` selects which underlying provider is active:
 *  - "kit"   → @creit.tech/stellar-wallets-kit (Freighter et al.)
 *  - "privy" → @privy-io/react-auth Stellar embedded wallet
 *  - "none"  → not connected
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { kit, connectWallet, getActiveProvider } from "../lib/wallet";
import type { WalletKind } from "../lib/walletProvider";

interface WalletState {
  address: string | null;
  kind: WalletKind;
  connecting: boolean;
  /** Used by the kit path. Privy callers use setWallet() directly. */
  connectKit: () => Promise<void>;
  setWallet: (address: string, kind: Exclude<WalletKind, "none">) => void;
  disconnect: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      kind: "none",
      connecting: false,
      connectKit: async () => {
        if (get().connecting) return;
        set({ connecting: true });
        try {
          const address = await connectWallet();
          set({ address, kind: "kit", connecting: false });
        } catch (err) {
          set({ connecting: false });
          throw err;
        }
      },
      setWallet: (address, kind) => {
        set({ address, kind });
      },
      disconnect: async () => {
        try {
          const provider = await getActiveProvider();
          await provider.disconnect();
        } catch {
          // Best-effort — kit may not be connected, Privy session may
          // already be cleared, or getActiveProvider may have returned
          // the wrong one if the store is mid-state-change.
        }
        try {
          await kit.disconnect();
        } catch {
          /* ignored */
        }
        set({ address: null, kind: "none" });
      },
      restore: async () => {
        const addr = get().address;
        const kind = get().kind;
        if (!addr || kind === "none") return;
        if (kind === "kit") {
          try {
            const { address } = await kit.getAddress();
            if (address && address !== addr) set({ address });
          } catch {
            set({ address: null, kind: "none" });
          }
        }
        // For "privy", PrivyWalletBridge populates the store on its own
        // when the SDK rehydrates the session — nothing to do here.
      },
    }),
    {
      name: "crackd-wallet",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ address: s.address, kind: s.kind }),
    },
  ),
);
