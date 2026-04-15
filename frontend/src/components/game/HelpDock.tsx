/**
 * HelpDock — floating "?" button that opens a compact rules panel with
 * a single worked example. Pattern matches ChatDock so the two bubbles
 * sit together bottom-right without taking any space when unused.
 *
 * Stacking: HelpDock sits just above ChatDock (same right edge, higher
 * bottom offset) so they form a neat vertical column on the right.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const MAGENTA = "#FF00A8";

/**
 * Worked example: `5831` is the secret. Three guesses walk the player
 * from "mostly miss" to "cracked". Each row is static text + the same
 * POT/PAN dots the live game uses, so learning here transfers 1:1.
 */
const EXAMPLE: Array<{
  guess: string;
  pots: number;
  pans: number;
  note: string;
  cracked?: boolean;
}> = [
  {
    guess: "5294",
    pots: 1,
    pans: 0,
    note: "5 is in the right place",
  },
  {
    guess: "5813",
    pots: 2,
    pans: 2,
    note: "5 & 1 right place, 8 & 3 wrong place",
  },
  {
    guess: "5831",
    pots: 4,
    pans: 0,
    note: "Cracked.",
    cracked: true,
  },
];

export function HelpDock() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-5 bottom-[156px] z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-[340px] max-w-[86vw] mb-3 panel-elevated overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-border">
              <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
                How it works
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-fg-muted hover:text-fg-primary text-lg leading-none"
                aria-label="Close help"
              >
                ×
              </button>
            </div>

            <div className="px-4 py-4">
              {/* Secret */}
              <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
                The Vault's secret
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {"5831".split("").map((c, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 grid place-items-center rounded-lg bg-ink-elevated border border-ink-border font-mono text-lg text-fg-primary"
                  >
                    {c}
                  </span>
                ))}
              </div>

              {/* Guesses */}
              <div className="mt-5 text-[10px] uppercase tracking-[0.22em] text-fg-muted">
                Your guesses
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {EXAMPLE.map((row, i) => (
                  <ExampleRow key={i} {...row} index={i} />
                ))}
              </div>

              {/* Legend */}
              <div className="mt-5 pt-4 border-t border-ink-border space-y-2 text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-accent" />
                  <span className="text-fg-primary font-medium">POT</span>
                  <span className="text-fg-secondary">— right digit, right place</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full border-2 border-accent/60" />
                  <span className="text-fg-primary font-medium">PAN</span>
                  <span className="text-fg-secondary">— right digit, wrong place</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-fg-dim" />
                  <span className="text-fg-primary font-medium">Miss</span>
                  <span className="text-fg-secondary">— digit isn't in the code</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-fg-muted">
                First to 4 POTs wins.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-12 w-12 rounded-full border transition-transform hover:-translate-y-0.5"
        style={{
          background: open ? "rgba(255,0,168,0.15)" : "rgba(4,0,8,0.85)",
          borderColor: "rgba(255,0,168,0.35)",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.6)",
        }}
        aria-label={open ? "Close rules" : "How it works"}
      >
        <span
          className="text-lg font-semibold"
          style={{ color: MAGENTA }}
        >
          ?
        </span>
      </button>
    </div>
  );
}

function ExampleRow({
  guess,
  pots,
  pans,
  note,
  cracked,
  index,
}: {
  guess: string;
  pots: number;
  pans: number;
  note: string;
  cracked?: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.35, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className={`rounded-xl px-3 py-2.5 border ${
        cracked ? "bg-accent/10 border-accent/40" : "bg-ink-elevated border-ink-border"
      }`}
    >
      <div className="flex items-center gap-2">
        {/* guess tiles */}
        <div className="flex items-center gap-1">
          {guess.split("").map((c, i) => (
            <span
              key={i}
              className="w-7 h-9 grid place-items-center rounded-md bg-ink-raised border border-ink-border font-mono text-sm text-fg-primary"
            >
              {c}
            </span>
          ))}
        </div>
        {/* result dots */}
        <div className="flex items-center gap-1 ml-2">
          <Dots pots={pots} pans={pans} delay={0.3 + index * 0.35} />
        </div>
      </div>
      <div
        className={`mt-1.5 text-[11px] ${cracked ? "text-accent font-medium uppercase tracking-[0.2em]" : "text-fg-muted"}`}
      >
        {note}
      </div>
    </motion.div>
  );
}

function Dots({
  pots,
  pans,
  delay,
}: {
  pots: number;
  pans: number;
  delay: number;
}) {
  const items: ("pot" | "pan" | "miss")[] = [];
  for (let i = 0; i < pots; i++) items.push("pot");
  for (let i = 0; i < pans; i++) items.push("pan");
  while (items.length < 4) items.push("miss");
  return (
    <>
      {items.map((d, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + i * 0.08, duration: 0.25 }}
          className={`w-2.5 h-2.5 rounded-full ${
            d === "pot"
              ? "bg-accent"
              : d === "pan"
                ? "border border-accent/60 bg-transparent"
                : "bg-fg-dim"
          }`}
        />
      ))}
    </>
  );
}
