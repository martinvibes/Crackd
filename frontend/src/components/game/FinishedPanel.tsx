/**
 * FinishedPanel — the celebration moment.
 *
 * Layering, in stacking order:
 *   · Radiating magenta sparks burst from behind the headline (CSS).
 *   · Shine sweeps across "Crackd." one time on mount.
 *   · Headline pops in with a spring (scale + y).
 *   · Revealed digits flip in with a glow pulse when they land.
 *   · Guess counts tick up from 0.
 *
 * Everything uses brand magenta + neutrals — no extra colours.
 */
import { animate, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { S2CGameOver } from "../../lib/socket";

const MAGENTA = "#FF00A8";

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
    <div className="max-w-3xl mx-auto animate-fade-in relative py-6">
      {/* Sparks — fixed backdrop, only rendered on a win */}
      {won && <Sparks />}

      {/* Kicker */}
      <div className="text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[11px] uppercase tracking-[0.3em] inline-flex items-center gap-2"
          style={{ color: won ? MAGENTA : "rgba(237,230,240,0.5)" }}
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: won ? MAGENTA : "rgba(237,230,240,0.4)" }}
          />
          {kicker}
        </motion.div>

        {/* Headline with shine sweep */}
        <Headline text={headline} won={won} />
      </div>

      {/* Revealed codes */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
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
          cracked={won}
        />
      </div>

      {/* Settlement link */}
      {finished.payoutTxHash && (
        <div className="mt-10 text-center text-sm">
          <span className="text-fg-muted">Settled on-chain · </span>
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
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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

// ============================================================
// Headline with a one-shot shine sweep across the letters
// ============================================================

function Headline({ text, won }: { text: string; won: boolean }) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: 30, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 18,
        mass: 1,
        delay: 0.15,
      }}
      className="relative mt-4 font-semibold tracking-[-0.04em] leading-[0.88]"
      style={{
        fontSize: "clamp(72px, 12vw, 160px)",
        color: won ? MAGENTA : undefined,
      }}
    >
      {text}
      {won && <ShineSweep />}
    </motion.h1>
  );
}

function ShineSweep() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        WebkitMaskImage:
          "linear-gradient(100deg, transparent 30%, black 50%, transparent 70%)",
        maskImage:
          "linear-gradient(100deg, transparent 30%, black 50%, transparent 70%)",
        WebkitMaskSize: "200% 100%",
        maskSize: "200% 100%",
        animation: "crackd-shine 2.2s ease-out 0.6s forwards",
      }}
    >
      <span
        className="absolute inset-0"
        style={{ background: "rgba(255,255,255,0.85)", mixBlendMode: "screen" }}
      />
      <style>{`
        @keyframes crackd-shine {
          0% { -webkit-mask-position: 200% 0; mask-position: 200% 0; }
          100% { -webkit-mask-position: -100% 0; mask-position: -100% 0; }
        }
      `}</style>
    </span>
  );
}

// ============================================================
// Sparks — small magenta dots that burst out from centre once
// ============================================================

function Sparks() {
  // Deterministic per mount — picks random angles/distances once.
  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }).map(() => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 120 + Math.random() * 220;
        const delay = Math.random() * 0.4;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 4 + Math.random() * 4,
          delay,
          duration: 1.0 + Math.random() * 0.9,
        };
      }),
    [],
  );

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <div className="absolute left-1/2 top-[140px] -translate-x-1/2">
        {sparks.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: 0,
              top: 0,
              width: s.size,
              height: s.size,
              background: MAGENTA,
              boxShadow: `0 0 ${s.size * 3}px ${MAGENTA}`,
              animation: `crackd-spark-${i} ${s.duration}s ease-out ${s.delay}s forwards`,
              opacity: 0,
            }}
          />
        ))}
      </div>
      <style>{sparks
        .map(
          (s, i) => `
          @keyframes crackd-spark-${i} {
            0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
            18% { opacity: 1; }
            100% { transform: translate(${s.dx}px, ${s.dy}px) scale(1); opacity: 0; }
          }`,
        )
        .join("")}</style>
    </div>
  );
}

// ============================================================
// Revealed code card — flip-in digits with landing glow + count-up
// ============================================================

function RevealedCode({
  label,
  code,
  guesses,
  pale,
  cracked,
}: {
  label: string;
  code: string;
  guesses: number;
  pale?: boolean;
  cracked?: boolean;
}) {
  const countStart = 0.35 + code.length * 0.12;
  return (
    <div
      className={`panel-elevated p-6 md:p-7 relative overflow-hidden transition-colors ${
        pale ? "" : "border-accent/30"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.28em] text-fg-muted flex items-center justify-between">
        <span>{label}</span>
        {cracked && (
          <span className="text-accent text-[9px] tracking-[0.28em]">Cracked</span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {code.split("").map((c, i) => (
          <DigitFlip key={i} char={c} delay={0.35 + i * 0.12} bright={!pale} />
        ))}
      </div>

      <div className="mt-4 text-xs text-fg-muted inline-flex items-center gap-1">
        <span>Cracked in</span>
        <CountUp value={guesses} delay={countStart} />
        <span>guess{guesses === 1 ? "" : "es"}</span>
      </div>
    </div>
  );
}

function DigitFlip({
  char,
  delay,
  bright,
}: {
  char: string;
  delay: number;
  bright?: boolean;
}) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), delay * 1000 + 500);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <motion.span
      initial={{ rotateX: -90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className={`w-12 h-14 md:w-14 md:h-16 grid place-items-center rounded-xl border font-mono text-2xl md:text-3xl font-semibold relative ${
        bright
          ? "bg-accent/10 border-accent/40 text-accent"
          : "bg-ink-elevated border-ink-border text-fg-primary"
      }`}
      style={{
        boxShadow:
          landed && bright
            ? `0 0 20px -4px ${MAGENTA}`
            : "none",
        transition: "box-shadow 400ms",
      }}
    >
      {char || "·"}
    </motion.span>
  );
}

/** Tiny framer-motion count-up that ticks from 0 → value. */
function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 16 });
  const [shown, setShown] = useState(0);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    const t = setTimeout(() => {
      const controls = animate(mv, value, {
        duration: 0.9,
        ease: [0.2, 0.8, 0.2, 1],
      });
      return () => controls.stop();
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [mv, value, delay]);

  useEffect(() => {
    return spring.on("change", (v) => setShown(Math.round(v)));
  }, [spring]);

  return <span className="font-mono text-fg-primary">{shown}</span>;
}
