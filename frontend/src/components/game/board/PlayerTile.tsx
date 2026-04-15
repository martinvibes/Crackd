/**
 * Player tile in the board header. Shows who you are, your code (masked
 * for opponent), turn activity, and guess count — at a glance.
 */
import { shortAddress } from "../../../lib/stellar";

export function PlayerTile({
  label,
  address,
  code,
  active,
  guessCount,
  rtl,
}: {
  label: string;
  address: string;
  code?: string;
  active?: boolean;
  guessCount: number;
  /** Mirror the layout for the opponent tile. */
  rtl?: boolean;
}) {
  return (
    <div
      className={`panel p-4 transition-colors ${active ? "border-accent/40" : ""}`}
    >
      <div
        className={`flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent animate-pulse" : "bg-fg-muted"}`}
        />
        <span className="text-[10px] uppercase tracking-[0.25em] text-fg-muted">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 flex items-baseline justify-between ${rtl ? "flex-row-reverse" : ""}`}
      >
        <span className="font-mono text-sm text-fg-primary">
          {address === "waiting"
            ? "waiting…"
            : address.startsWith("G")
              ? shortAddress(address, 4)
              : address}
        </span>
        <span className="font-mono text-xs text-fg-muted">
          {guessCount} guess{guessCount === 1 ? "" : "es"}
        </span>
      </div>
      <div
        className={`mt-3 flex items-center gap-1 ${rtl ? "justify-end" : ""}`}
      >
        {(code ?? "····").split("").map((c, i) => (
          <span
            key={i}
            className="w-7 h-9 grid place-items-center rounded-md bg-ink-elevated border border-ink-border font-mono text-[15px] text-fg-primary"
          >
            {c === "•" ? "·" : c}
          </span>
        ))}
      </div>
    </div>
  );
}
