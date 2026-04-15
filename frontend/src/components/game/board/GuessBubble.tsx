/**
 * A single row in the guess timeline — chat-bubble shape.
 *
 * Mine align right with magenta tint, opponent's align left in neutral.
 * The four "result dots" (POT = solid, PAN = ring, miss = dim) carry
 * the feedback inline so there are no separate chips cluttering the row.
 */
import type { TimelineItem } from "./timeline";

export function GuessBubble({ side, code, result, redacted }: TimelineItem) {
  const mine = side === "you";
  const cracked = result.pots === 4;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-3 border animate-slide-up ${
          mine
            ? cracked
              ? "bg-accent/20 border-accent/50"
              : "bg-accent/5 border-accent/20"
            : "bg-ink-elevated border-ink-border"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-[0.25em] ${mine ? "text-accent" : "text-fg-muted"}`}
          >
            {mine ? "You" : "Opponent"}
          </span>
          {cracked && (
            <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-semibold">
              · Cracked
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {code.split("").map((c, i) => (
              <span
                key={i}
                className={`w-9 h-11 grid place-items-center rounded-lg font-mono text-lg border ${
                  redacted
                    ? "bg-ink-raised border-ink-border text-fg-muted"
                    : mine
                      ? "bg-ink-elevated border-ink-border text-fg-primary"
                      : "bg-ink-raised border-ink-border text-fg-primary"
                }`}
              >
                {redacted ? "·" : c}
              </span>
            ))}
          </div>
          <ResultDots pots={result.pots} pans={result.pans} />
        </div>
      </div>
    </div>
  );
}

/**
 * Four dots, left-to-right. POT (right-place) solid, PAN (wrong-place)
 * ring, miss faint. Visually immediate — no extra labels needed.
 */
function ResultDots({ pots, pans }: { pots: number; pans: number }) {
  const total = 4;
  const dots: ("pot" | "pan" | "miss")[] = [];
  for (let i = 0; i < pots; i++) dots.push("pot");
  for (let i = 0; i < pans; i++) dots.push("pan");
  while (dots.length < total) dots.push("miss");
  return (
    <div className="flex items-center gap-1" aria-label={`${pots} POT, ${pans} PAN`}>
      {dots.map((d, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${
            d === "pot"
              ? "bg-accent"
              : d === "pan"
                ? "border border-accent/60 bg-transparent"
                : "bg-fg-dim"
          }`}
          title={
            d === "pot"
              ? "POT · right place"
              : d === "pan"
                ? "PAN · wrong place"
                : "miss"
          }
        />
      ))}
    </div>
  );
}
