/**
 * Bridge between Privy's React state and the module-level singleton in
 * lib/privy.ts. Renders nothing.
 *
 * Responsibilities on every Privy state change:
 *   - If logged in but no Stellar embedded wallet exists → create one.
 *   - Once a Stellar wallet is present → mirror its address + signRawHash
 *     into lib/privy.ts so non-React callers (Game.tsx → getActiveProvider
 *     → signTransaction) can reach the wallet synchronously.
 *   - Set walletStore { kind: "privy", address }.
 *   - Fire-and-forget POST /api/onboarding/fund so a fresh wallet gets
 *     friendbot XLM (idempotent server-side).
 *   - On logout: clear lib/privy.ts state and (if walletStore says we're
 *     the active kind) reset walletStore.
 */
import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useCreateWallet,
  useSignRawHash,
} from "@privy-io/react-auth/extended-chains";
import { setPrivyState } from "./privy";
import { useWalletStore } from "../store/walletStore";
import { api } from "./api";

export function PrivyWalletBridge() {
  const { authenticated, ready, user, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();
  const setWallet = useWalletStore((s) => s.setWallet);
  const disconnect = useWalletStore((s) => s.disconnect);
  // Guards so we don't double-create wallets or double-fund.
  const creatingRef = useRef(false);
  const fundedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    // Logged out → tear down.
    if (!authenticated || !user) {
      setPrivyState(null);
      if (useWalletStore.getState().kind === "privy") {
        void disconnect();
      }
      creatingRef.current = false;
      fundedRef.current = null;
      return;
    }

    // Find the user's Stellar embedded wallet, if any. Privy's TS types
    // use `chainType` (camelCase) but their REST serialisation has used
    // `chain_type` (snake) historically — accept either to be safe.
    const stellar = user.linkedAccounts.find(
      (a): a is typeof a & { address: string } => {
        if ((a as { type?: string }).type !== "wallet") return false;
        const ct =
          (a as { chainType?: string }).chainType ??
          (a as { chain_type?: string }).chain_type;
        return ct === "stellar";
      },
    );

    if (!stellar) {
      // No Stellar wallet yet — create one. Privy's auto-create config
      // only covers ethereum/solana; Stellar is an extended chain so we
      // call createWallet ourselves.
      if (creatingRef.current) return;
      creatingRef.current = true;
      void createWallet({ chainType: "stellar" })
        .catch((err) => {
          console.error("[privy] createWallet(stellar) failed:", err);
          creatingRef.current = false;
        });
      return;
    }

    // Stellar wallet ready — wire it up.
    setPrivyState({
      address: stellar.address,
      signRawHash: (input) => signRawHash(input),
      logout: async () => {
        await logout();
      },
    });
    setWallet(stellar.address, "privy");

    // First-time funding (idempotent server-side). Don't await — vs-AI
    // free works without funds, and the staked path will surface a
    // friendly error if the user clicks too early.
    if (fundedRef.current !== stellar.address) {
      fundedRef.current = stellar.address;
      void api.onboardingFund(stellar.address).catch((err) => {
        console.warn("[privy] onboarding fund call failed:", err);
      });
    }
  }, [
    ready,
    authenticated,
    user,
    createWallet,
    signRawHash,
    setWallet,
    disconnect,
    logout,
  ]);

  return null;
}
