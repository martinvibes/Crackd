/**
 * Hero header above the guess timeline. Three layers:
 *   1. TurnBadge — a live, colour-coded pill at the top.
 *   2. Huge statement — the current "act" (setting code / your turn / their turn).
 *   3. Player strip — two tiles with codes + guess counts.
 *   4. Optional Pidgin taunt strip when The Vault has something to say.
 */
import type { SafeGameView } from "../../../lib/socket";
import { PlayerTile } from "./PlayerTile";

export function BoardHeader({
  view,
  walletAddress,
  tauntLine,
}: {
  view: SafeGameView;
  walletAddress: string;
  tauntLine: string | null;
}) {
  const yours = view.currentTurn === view.you && view.status === "active";
  const needsCode = view.status === "setting_codes";
  const isAi = view.mode === "vs_ai_free" || view.mode === "vs_ai_staked";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Turn badge — immediate visual who-moves-now */}
      <div className="flex justify-center">
        <TurnBadge state={needsCode ? "setup" : yours ? "you" : "opponent"} />
      </div>

      {/* Big statement */}
      <div className="mt-4 text-center">
        <div
          className="font-semibold leading-[0.9] tracking-[-0.03em]"
          style={{ fontSize: "clamp(38px, 6vw, 68px)" }}
        >
          {needsCode ? (
            <>
              Pick your <span className="text-accent">secret.</span>
            </>
          ) : yours ? (
            <>
              Make a <span className="text-accent">crack.</span>
            </>
          ) : isAi ? (
            <>
              The Vault's{" "}
              <span className="text-fg-secondary italic">thinking…</span>
            </>
          ) : (
            <>
              Opponent's{" "}
              <span className="text-fg-secondary italic">thinking…</span>
            </>
          )}
        </div>
      </div>

      {/* Player strip — two columns, no "VS" rail on mobile (too cramped) */}
      <div className="mt-6 md:mt-7 grid grid-cols-2 gap-2 md:gap-4 relative">
        <PlayerTile
          label="You"
          address={walletAddress}
          code={view.yourCode}
          active={yours}
          guessCount={view.yourGuesses.length}
        />
        {/* VS badge — floats between tiles on md+ only */}
        <span
          className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-ink text-[10px] uppercase tracking-[0.25em] text-fg-muted border border-ink-border z-10"
          aria-hidden
        >
          vs
        </span>
        <PlayerTile
          label={view.opponent === "vault" ? "The Vault" : "Opponent"}
          address={view.opponent ?? "waiting"}
          code={view.opponentCodeSet ? "••••" : "——"}
          active={!yours && view.status === "active"}
          guessCount={view.opponentGuesses.length}
          rtl
        />
      </div>

      {tauntLine && (
        <div
          className="mt-4 px-4 py-3 rounded-xl text-sm leading-snug border animate-slide-up"
          style={{
            background: "rgba(255, 0, 168, 0.05)",
            borderColor: "rgba(255, 0, 168, 0.18)",
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.25em] text-accent/80 mr-2">
            The Vault
          </span>
          <span className="text-fg-primary">{tauntLine}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The turn pill. Three states, each with its own colour and motion:
 *   - "setup" = neutral, no pulse
 *   - "you"   = magenta, pulsing ring
 *   - "opponent" = muted, animated ellipsis
 */
function TurnBadge({ state }: { state: "setup" | "you" | "opponent" }) {
  if (state === "setup") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.28em] border border-ink-border bg-ink-raised text-fg-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-fg-muted" />
        Setting codes
      </span>
    );
  }
  if (state === "you") {
    return (
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.28em] border"
        style={{
          background: "rgba(255, 0, 168, 0.08)",
          borderColor: "rgba(255, 0, 168, 0.35)",
          color: "#FF00A8",
        }}
      >
        <PulsingDot />
        Your turn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.28em] border border-ink-border bg-ink-raised text-fg-secondary">
      <span className="inline-flex">
        <span className="w-1 h-1 rounded-full bg-fg-muted animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1 h-1 rounded-full bg-fg-muted animate-bounce [animation-delay:-0.15s] ml-0.5" />
        <span className="w-1 h-1 rounded-full bg-fg-muted animate-bounce ml-0.5" />
      </span>
      <span>Opponent turn</span>
    </span>
  );
}

function PulsingDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full rounded-full animate-ping"
        style={{ background: "#FF00A8" }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: "#FF00A8" }}
      />
    </span>
  );
}
