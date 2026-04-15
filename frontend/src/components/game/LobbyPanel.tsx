/**
 * Lobby — shown after creating a multiplayer game, while waiting for a
 * second player. Designed so the invite code is the unambiguous hero,
 * and the "this is not vs-AI" mode pill is clear at a glance.
 */
import { useState } from "react";
import { BackLink } from "./BackLink";
import { modeLabel, type Mode } from "./ModePicker";

export function LobbyPanel({
  inviteCode,
  mode,
  onCancel,
}: {
  inviteCode: string;
  mode: Mode;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="animate-fade-in max-w-xl mx-auto">
      <BackLink label="Leave lobby" onClick={onCancel} />

      <div className="mt-6 panel-elevated p-8 md:p-10 text-center relative overflow-hidden">
        {/* mode pill */}
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.28em] border border-ink-border text-fg-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          {modeLabel(mode)}
        </span>

        <h1 className="mt-5 text-4xl md:text-5xl font-semibold tracking-[-0.03em] leading-tight">
          Share this <span className="text-accent">invite.</span>
        </h1>
        <p className="mt-3 text-fg-secondary text-sm max-w-sm mx-auto">
          Send it to a friend. The match starts the moment they join.
        </p>

        {/* Giant invite code */}
        <div className="mt-8 mx-auto inline-flex flex-col items-center gap-3 rounded-2xl border border-ink-border px-8 py-6 bg-ink">
          <span className="text-[10px] uppercase tracking-[0.3em] text-fg-muted">
            Invite code
          </span>
          <span
            className="font-mono text-5xl md:text-6xl tracking-[0.25em] select-all"
            style={{ color: "#FF00A8" }}
          >
            {inviteCode}
          </span>
          <button onClick={copy} className="btn-primary mt-2">
            {copied ? "Copied ✓" : "Copy code"}
          </button>
        </div>

        <div className="mt-8 inline-flex items-center gap-2 text-xs text-fg-muted">
          <span className="h-1.5 w-1.5 bg-accent rounded-full animate-pulse" />
          Waiting for opponent to join…
        </div>

        <div className="mt-6">
          <button onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
