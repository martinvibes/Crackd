/**
 * Board — live game once both players have joined.
 *
 * Layout: fixed-height flex column. The timeline scrolls INSIDE the
 * board, auto-sticks to the newest guess, and the composer is always
 * pinned directly below it. Page itself does not scroll during play.
 *
 *   BoardHeader (auto) ─────────────────────
 *   Timeline (flex-1, internal scroll) ─────
 *   Composer (auto, pinned) ────────────────
 *
 * Chat lives elsewhere (floating ChatDock) so it never competes with
 * the timeline for screen space.
 */
import { useEffect, useRef, useState } from "react";
import type { SafeGameView } from "../../../lib/socket";
import { BoardHeader } from "./BoardHeader";
import { GuessBubble } from "./GuessBubble";
import { Composer } from "./Composer";
import { buildTimeline } from "./timeline";

export function Board({
  walletAddress,
  view,
  tauntLine,
  onSetCode,
  onGuess,
}: {
  walletAddress: string;
  view: SafeGameView;
  tauntLine: string | null;
  onSetCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onGuess: (guess: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const needsToSetCode = view.status === "setting_codes" && !view.yourCode;
  const isYourTurn = view.currentTurn === view.you && view.status === "active";

  async function submit() {
    const code = draft.replace(/\D/g, "").slice(0, 4);
    if (code.length !== 4) {
      setError("Enter 4 digits");
      return;
    }
    setError(null);
    const r = await (needsToSetCode ? onSetCode(code) : onGuess(code));
    if (!r.ok) setError(r.error ?? "Try again");
    else setDraft("");
  }

  const timeline = buildTimeline(view);

  // Auto-scroll the timeline so the newest bubble is always in view.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // smooth for incremental changes; instant on first paint
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [timeline.length, tauntLine]);

  return (
    <div
      className="animate-fade-in flex flex-col"
      style={{ minHeight: "calc(100vh - 180px)" }}
    >
      <BoardHeader
        view={view}
        walletAddress={walletAddress}
        tauntLine={tauntLine}
      />

      {/* Stake info bar — only for staked games */}
      {(view.mode === "vs_ai_staked" || view.mode === "pvp_staked") &&
        view.stakeAmount > 0 && (
          <StakeBar
            stakeAmount={view.stakeAmount}
            guessCount={view.yourGuesses.length}
          />
        )}

      {/* Scrolling timeline */}
      <div
        ref={scrollerRef}
        className="mt-6 max-w-2xl w-full mx-auto flex-1 overflow-y-auto scroll-smooth pr-1"
        style={{ minHeight: "220px", maxHeight: "52vh" }}
      >
        <div className="flex flex-col gap-3 py-1">
          {timeline.length === 0 ? (
            <EmptyState needsToSetCode={needsToSetCode} />
          ) : (
            timeline.map((item, i) => (
              <GuessBubble
                key={`${item.side}-${item.timestamp}-${i}`}
                {...item}
              />
            ))
          )}
        </div>
      </div>

      {/* Composer — always pinned just below the timeline */}
      <div className="mt-4 max-w-2xl w-full mx-auto">
        <Composer
          disabled={!needsToSetCode && !isYourTurn}
          placeholder={
            needsToSetCode
              ? "Lock in your secret 4-digit code"
              : isYourTurn
                ? "Enter your guess"
                : "Waiting for opponent…"
          }
          submitLabel={needsToSetCode ? "Lock code" : "Submit"}
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          error={error}
        />
      </div>
    </div>
  );
}

/**
 * Persistent strip during staked games showing what's on the line +
 * the current reward tier based on guesses used so far.
 */
function StakeBar({
  stakeAmount,
  guessCount,
}: {
  stakeAmount: number;
  guessCount: number;
}) {
  const xlm = stakeAmount / 10_000_000;
  // Current tier based on guesses so far (next guess = guessCount + 1).
  const nextGuess = guessCount + 1;
  const tier =
    nextGuess <= 3
      ? { label: "2.5×", desc: "Lightning" }
      : nextGuess <= 5
        ? { label: "2.25×", desc: "Sharp" }
        : { label: "2×", desc: "Base win" };
  const potentialWin = xlm * (nextGuess <= 3 ? 2.5 : nextGuess <= 5 ? 2.25 : 2.0);

  return (
    <div className="mt-4 max-w-2xl mx-auto">
      <div
        className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl border text-sm"
        style={{
          background: "rgba(255,0,168,0.04)",
          borderColor: "rgba(255,0,168,0.2)",
        }}
      >
        <div className="flex items-center gap-2 text-fg-secondary">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#FF00A8" }}
          />
          <span>
            Staked <span className="text-fg-primary font-mono">{xlm}</span> XLM
          </span>
        </div>
        <div className="flex items-center gap-3 text-fg-secondary">
          <span className="hidden sm:inline text-[10px] uppercase tracking-[0.22em] text-fg-muted">
            {tier.desc}
          </span>
          <span style={{ color: "#FF00A8" }} className="font-semibold">
            {tier.label}
          </span>
          <span className="text-fg-muted">→</span>
          <span className="text-fg-primary font-mono">
            {potentialWin.toFixed(1)} XLM
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ needsToSetCode }: { needsToSetCode: boolean }) {
  return (
    <div className="panel px-4 md:px-6 py-6 md:py-10 text-center">
      <div className="text-[10px] uppercase tracking-[0.28em] text-fg-muted">
        {needsToSetCode ? "Step 1" : "Make the first move"}
      </div>
      <div className="mt-3 text-sm md:text-base text-fg-secondary max-w-sm mx-auto leading-relaxed">
        {needsToSetCode
          ? "Lock in four digits below. No repeats. Opponent never sees it."
          : "Type four digits in the composer. Each guess gets four dots back — solid for right place, ring for wrong place."}
      </div>
    </div>
  );
}
