/**
 * Finished — the game-over hero. Designed to land:
 *   - Giant result word (CRACKD / UNBREAKABLE / DRAW)
 *   - Revealed opponent code flipping in one digit at a time
 *   - Two-column recap showing both sides' guess trails
 *   - Play again / Share / Settlement tx footer
 *
 * Motion is quiet — one reveal, small slides, no confetti. Magenta
 * used only for the result word when the player wins, and for the
 * settlement tx link.
 */
import { motion } from "framer-motion";
import type { S2CGameOver } from "../../lib/socket";

export function FinishedPanel({
  finished,
  me,
  onPlayAgain,
}: {
  finished: S2CGameOver;
  me?: string;
  onPlayAgain: () => void;
}) {
  const won = finished.winner === me;
  const draw = finished.isDraw;
  const headline = draw ? "Draw." : won ? "Crackd." : "Unbreakable.";
  const kicker = draw ? "Even match" : won ? "You won" : "The Vault holds";

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Kicker + headline */}
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-fg-muted">
          {kicker}
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-4 font-semibold tracking-[-0.04em] leading-[0.88]"
          style={{
            fontSize: "clamp(72px, 12vw, 160px)",
            color: won ? "#FF00A8" : undefined,
          }}
        >
          {headline}
        </motion.h1>
      </div>

      {/* Revealed codes */}
      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4">
        <RevealedCode
          label="Your code"
          code={finished.final.playerOneCode}
          guesses={finished.final.playerTwoGuesses.length}
          pale
        />
        <RevealedCode
          label="Opponent's code"
          code={finished.final.playerTwoCode}
          guesses={finished.final.playerOneGuesses.length}
        />
      </div>

      {/* Settlement link */}
      {finished.payoutTxHash && (
        <div className="mt-10 text-center text-sm">
          <span className="text-fg-muted">Settled on-chain — </span>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${finished.payoutTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline underline-offset-4"
          >
            {finished.payoutTxHash.slice(0, 12)}…
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <button className="btn-primary" onClick={onPlayAgain}>
          Play again
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const text = `I just ${won ? "crackd" : "played"} on Crackd — ${finished.final.playerOneCode} vs ${finished.final.playerTwoCode}. Who can crack me? 🔐`;
            navigator.clipboard.writeText(text);
          }}
        >
          Copy share card
        </button>
      </div>
    </div>
  );
}

/**
 * Four flip-in digits + guess count, stacked as a neat card.
 */
function RevealedCode({
  label,
  code,
  guesses,
  pale,
}: {
  label: string;
  code: string;
  guesses: number;
  /** Render with a subdued border (used for "your code" — no drama). */
  pale?: boolean;
}) {
  return (
    <div
      className={`panel-elevated p-6 md:p-7 ${pale ? "" : "border-accent/30"}`}
    >
      <div className="text-[10px] uppercase tracking-[0.28em] text-fg-muted">
        {label}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {code.split("").map((c, i) => (
          <motion.span
            key={i}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.12, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className={`w-12 h-14 md:w-14 md:h-16 grid place-items-center rounded-xl border font-mono text-2xl md:text-3xl font-semibold ${
              pale
                ? "bg-ink-elevated border-ink-border text-fg-primary"
                : "bg-accent/10 border-accent/40 text-accent"
            }`}
          >
            {c || "·"}
          </motion.span>
        ))}
      </div>
      <div className="mt-4 text-xs text-fg-muted">
        Cracked in {guesses} guess{guesses === 1 ? "" : "es"}
      </div>
    </div>
  );
}
