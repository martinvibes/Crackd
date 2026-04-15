/**
 * Lobby — shown after creating a PvP game, while waiting for a second
 * player. Displays a short invite code the user can copy + a live pulse.
 */
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
  return (
    <div className="animate-fade-in">
      <BackLink label="Leave lobby" onClick={onCancel} />

      <div className="mt-6 panel-elevated p-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
          {modeLabel(mode)} · Waiting
        </div>
        <div className="mt-3 text-2xl font-semibold">Share this invite.</div>

        <div className="mt-6 inline-flex items-center gap-3 px-5 py-4 rounded-xl bg-ink border border-ink-border">
          <span className="font-mono text-3xl tracking-[0.3em] text-accent">
            {inviteCode}
          </span>
          <button
            className="btn-ghost py-1.5"
            onClick={() => navigator.clipboard.writeText(inviteCode)}
          >
            Copy
          </button>
        </div>

        <div className="mt-8 text-xs text-fg-muted">
          Waiting for opponent to join…{" "}
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-accent rounded-full animate-pulse" />
            live
          </span>
        </div>
        <button onClick={onCancel} className="btn-ghost mt-6">
          Cancel
        </button>
      </div>
    </div>
  );
}
