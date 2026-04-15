/**
 * Wallet pill in the top-right. Opens the multi-wallet modal on click,
 * or collapses to a short address + disconnect when connected.
 */
import { useState } from "react";
import { useWalletStore } from "../store/walletStore";
import { shortAddress } from "../lib/stellar";

export default function WalletButton() {
  const { address, connecting, connect, disconnect } = useWalletStore();
  const [open, setOpen] = useState(false);

  if (!address) {
    return (
      <button
        className="btn-primary group"
        disabled={connecting}
        onClick={() => connect().catch(console.error)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-ink inline-block" />
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        className="chip hover:border-ink-border-strong transition-colors flex items-center gap-2 pr-1 pl-3 py-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        <span className="font-mono text-fg-primary">{shortAddress(address, 5)}</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest text-fg-muted bg-ink-raised">
          testnet
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-64 panel-elevated z-50 p-2 animate-slide-up">
            <div className="px-3 py-2.5 text-[11px] uppercase tracking-[0.18em] text-fg-muted">
              Connected wallet
            </div>
            <div className="px-3 pb-2 font-mono text-xs text-fg-secondary break-all">
              {address}
            </div>
            <div className="divider my-1" />
            <button
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-ink-elevated text-danger"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
