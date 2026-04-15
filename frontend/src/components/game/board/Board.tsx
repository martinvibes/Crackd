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

function EmptyState({ needsToSetCode }: { needsToSetCode: boolean }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-fg-muted">
        {needsToSetCode ? "Step 1" : "Make the first move"}
      </div>
      <div className="mt-3 text-lg text-fg-secondary max-w-sm mx-auto leading-relaxed">
        {needsToSetCode
          ? "Lock in four digits below. No repeats. Opponent never sees it."
          : "Type four digits in the composer. Each guess gets four dots back — solid for right place, ring for wrong place."}
      </div>
    </div>
  );
}
