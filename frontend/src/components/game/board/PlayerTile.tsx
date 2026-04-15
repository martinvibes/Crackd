/**
 * Player tile in the board header. Shows who you are, your code (masked
 * for opponent), turn activity, and guess count.
 *
 * Mobile layout stacks address above guess-count so a short address
 * doesn't fight the count on the same row. Code tiles shrink below sm.
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
  const display =
    address === "waiting"
      ? "waiting…"
      : address.startsWith("G")
        ? shortAddress(address, 4)
        : address;

  return (
    <div
      className={`panel p-3 md:p-4 min-w-0 transition-colors ${active ? "border-accent/40" : ""}`}
    >
      <div
        className={`flex items-center gap-2 ${rtl ? "flex-row-reverse" : ""}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-accent animate-pulse" : "bg-fg-muted"}`}
        />
        <span className="text-[10px] uppercase tracking-[0.22em] text-fg-muted truncate">
          {label}
        </span>
      </div>

      {/* Address + guess count. Stacks on mobile, spreads on md+. */}
      <div
        className={`mt-2 flex flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-3 ${
          rtl ? "md:flex-row-reverse" : ""
        }`}
      >
        <span className="font-mono text-xs md:text-sm text-fg-primary truncate">
          {display}
        </span>
        <span className="font-mono text-[10px] md:text-xs text-fg-muted whitespace-nowrap">
          {guessCount} guess{guessCount === 1 ? "" : "es"}
        </span>
      </div>

      {/* Code tiles */}
      <div
        className={`mt-2.5 md:mt-3 flex items-center gap-1 ${rtl ? "justify-end" : ""}`}
      >
        {(code ?? "····").split("").map((c, i) => (
          <span
            key={i}
            className="w-6 h-8 md:w-7 md:h-9 grid place-items-center rounded-md bg-ink-elevated border border-ink-border font-mono text-[13px] md:text-[15px] text-fg-primary"
          >
            {c === "•" ? "·" : c}
          </span>
        ))}
      </div>
    </div>
  );
}
