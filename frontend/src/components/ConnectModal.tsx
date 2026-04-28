/**
 * Two-section connect modal.
 *  - Top: Privy social login (one button — Privy's own modal handles the
 *    method picker once opened). Hidden if Privy isn't configured.
 *  - Divider.
 *  - Bottom: existing wallet-kit modal entry for crypto-native users.
 *
 * Rendered via createPortal into document.body so `position: fixed`
 * works correctly even when an ancestor has `transform`/`filter`/
 * `will-change` (which create a new containing block and would
 * otherwise pin our "viewport-fixed" modal to the ancestor's box).
 *
 * Pure presentation; the host component (WalletButton) controls open/close.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useWalletStore } from "../store/walletStore";

export function ConnectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // usePrivy throws if no <PrivyProvider> is in the tree. main.tsx
  // skips wrapping when VITE_PRIVY_APP_ID is unset, so we mirror that
  // here: try-catch isn't possible inside a hook, but we read the env
  // and conditionally render the Privy half.
  const privyEnabled = !!import.meta.env.VITE_PRIVY_APP_ID;
  return (
    <ModalShell open={open} onClose={onClose}>
      {privyEnabled ? (
        <PrivySection onChosen={onClose} />
      ) : (
        <div className="text-xs text-fg-muted leading-relaxed">
          Email/Google/Apple login is not configured in this environment.
        </div>
      )}

      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-fg-muted">
        <div className="h-px flex-1 bg-ink-border" />
        or
        <div className="h-px flex-1 bg-ink-border" />
      </div>

      <KitSection onChosen={onClose} />

      <div className="mt-4 text-[11px] text-fg-muted leading-relaxed">
        Email sign-in creates a custodial wallet — exportable anytime.
      </div>
    </ModalShell>
  );
}

function ModalShell({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll while open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal into document.body so position:fixed is relative to the
  // viewport, not whatever ancestor (the home hero, framer-motion
  // transforms, etc.) happens to be a containing block.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-ink/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          // Click on the gutter (outside the panel) closes the modal.
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="panel-elevated w-full max-w-sm p-6 my-auto">
          <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
            Connect to play
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
            Get started in 30s.
          </h2>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function PrivySection({ onChosen }: { onChosen: () => void }) {
  const { login, ready } = usePrivy();
  return (
    <button
      className="w-full px-4 py-3.5 rounded-xl border border-accent/30 bg-accent/10 hover:border-accent/60 hover:bg-accent/15 transition-colors text-left disabled:opacity-50 disabled:cursor-wait flex items-center gap-3"
      disabled={!ready}
      onClick={() => {
        login();
        onChosen();
      }}
    >
      <span aria-hidden className="grid place-items-center w-9 h-9 rounded-lg bg-accent/15 text-accent">
        <PrivyGlyph />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-fg-primary">
          Continue with email or social
        </span>
        <span className="block text-xs text-fg-muted mt-0.5">
          Email · Google · Apple — no wallet install
        </span>
      </span>
      <span aria-hidden className="text-fg-muted text-sm">→</span>
    </button>
  );
}

function PrivyGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7l8 5 8-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function KitSection({ onChosen }: { onChosen: () => void }) {
  const connectKit = useWalletStore((s) => s.connectKit);
  return (
    <button
      className="w-full px-4 py-3.5 rounded-xl border border-ink-border bg-ink-elevated hover:border-ink-border-strong transition-colors text-left flex items-center gap-3"
      onClick={async () => {
        try {
          await connectKit();
        } finally {
          onChosen();
        }
      }}
    >
      <span
        aria-hidden
        className="grid place-items-center w-9 h-9 rounded-lg bg-ink-raised text-fg-secondary"
      >
        <KitGlyph />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">Connect a crypto wallet</span>
        <span className="block text-xs text-fg-muted mt-0.5">
          Freighter · Albedo · xBull · Lobstr · Hana · Rabet
        </span>
      </span>
      <span aria-hidden className="text-fg-muted text-sm">→</span>
    </button>
  );
}

function KitGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3 9h13a2 2 0 012 2v3a2 2 0 01-2 2H3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="16" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
