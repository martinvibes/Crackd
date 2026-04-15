/**
 * FinishedPanel — the game-over moment.
 *
 * Three end-states with distinct copy + visual weight:
 *   WIN   → "Crackd." Magenta headline, sparks, shine sweep, flipping
 *           opponent's code as the trophy, stat strip with guess count +
 *           multiplier bonus if staked.
 *   LOSS  → "Locked out." Neutral headline. Shows which code the
 *           opponent broke + how many tries it took them. Vs-AI gets a
 *           Pidgin sting line for personality.
 *   DRAW  → "Stalemate." Neutral, symmetric — both codes shown small.
 *
 * Only wins get magenta + sparks. Losses and draws stay restrained.
 */
import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { S2CGameOver } from "../../lib/socket";

const MAGENTA = "#FF00A8";
/**
 * Muted, saturated-but-not-alarming red for the loss state. A touch
 * desaturated so it reads as defeat, not a system error.
 */
const LOSS_RED = "#FF5C6A";

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
  const lost = !won && !draw;

  // Winner lost to the Vault vs another human — changes the loss copy.
  const lostToVault = lost && finished.winner === "vault";

  const kicker = draw
    ? "Neck and neck"
    : won
      ? "You cracked it"
      : lostToVault
        ? "The Vault cracked you"
        : "Outplayed";
  const headline = draw ? "Stalemate." : won ? "Crackd." : "Locked out.";

  const yourGuesses = finished.final.playerOneGuesses.length;
  const theirGuesses = finished.final.playerTwoGuesses.length;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in relative py-6">
      {won && <Sparks />}

      {/* Kicker + headline */}
      <div className="text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em]"
          style={{
            color: won
              ? MAGENTA
              : lost
                ? LOSS_RED
                : "rgba(237,230,240,0.55)",
          }}
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{
              background: won
                ? MAGENTA
                : lost
                  ? LOSS_RED
                  : "rgba(237,230,240,0.45)",
            }}
          />
          {kicker}
        </motion.div>

        <Headline text={headline} won={won} lost={lost} />

        {/* Outcome sub-line — sentence-form so it's unambiguous */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-5 text-base md:text-lg text-fg-secondary max-w-md mx-auto"
        >
          {draw
            ? "Both of you went the distance. Nobody got the code first."
            : won
              ? `You broke the code in ${yourGuesses} guess${yourGuesses === 1 ? "" : "es"}.`
              : lostToVault
                ? `The Vault broke your code in ${theirGuesses} guess${theirGuesses === 1 ? "" : "es"}. Omo, don't vex — try am again.`
                : `Your opponent cracked your code in ${theirGuesses} guess${theirGuesses === 1 ? "" : "es"}.`}
        </motion.div>
      </div>

      {/* Stats strip */}
      <StatsStrip
        won={won}
        draw={draw}
        yourGuesses={yourGuesses}
        theirGuesses={theirGuesses}
        maxGuesses={10}
        payoutTxHash={finished.payoutTxHash}
      />

      {/* Revealed code (hero changes based on outcome) */}
      <div className="mt-10">
        {draw ? (
          <DrawCards finished={finished} />
        ) : won ? (
          <HeroCode
            label="Opponent's code"
            subtext={`Cracked in ${yourGuesses} guess${yourGuesses === 1 ? "" : "es"}`}
            code={finished.final.playerTwoCode}
            tone="win"
          />
        ) : (
          <HeroCode
            label="Your code was exposed"
            subtext={`Cracked in ${theirGuesses} guess${theirGuesses === 1 ? "" : "es"}`}
            code={finished.final.playerOneCode}
            tone="loss"
          />
        )}
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
          {won ? "Play again" : "Rematch"}
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const text = won
              ? `I just crackd The Vault in ${yourGuesses} guesses on Crackd. Come catch me 🔐`
              : `I just went down to The Vault — but only ${theirGuesses} guesses in. Your turn to try 🔐`;
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
// Stats strip — 3 tiles of context-relevant numbers
// ============================================================

function StatsStrip({
  won,
  draw,
  yourGuesses,
  theirGuesses,
  maxGuesses,
  payoutTxHash,
}: {
  won: boolean;
  draw: boolean;
  yourGuesses: number;
  theirGuesses: number;
  maxGuesses: number;
  payoutTxHash?: string;
}) {
  const multiplier =
    yourGuesses <= 3
      ? "2.0×"
      : yourGuesses <= 5
        ? "1.5×"
        : yourGuesses <= 7
          ? "1.0×"
          : "0.75×";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.95, duration: 0.6 }}
      className="mt-10 grid grid-cols-3 gap-3 max-w-xl mx-auto"
    >
      <Stat
        label="Your guesses"
        value={<CountUp value={yourGuesses} delay={1.1} />}
        suffix={`/ ${maxGuesses}`}
        highlight={won}
      />
      <Stat
        label={draw ? "Opponent" : won ? "Opponent" : "They cracked in"}
        value={<CountUp value={theirGuesses} delay={1.2} />}
        suffix={draw ? "guesses" : "guesses"}
      />
      <Stat
        label={payoutTxHash ? "Multiplier" : "Result"}
        value={won ? multiplier : draw ? "—" : "L"}
        tone={won ? "win" : draw ? "neutral" : "loss"}
      />
    </motion.div>
  );
}

function Stat({
  label,
  value,
  suffix,
  highlight,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  /** Adds a magenta glow ring (used for the winning-guesses tile). */
  highlight?: boolean;
  tone?: "neutral" | "win" | "loss";
}) {
  const accent =
    tone === "win" ? MAGENTA : tone === "loss" ? LOSS_RED : undefined;
  return (
    <div
      className="panel p-4"
      style={{
        borderColor:
          highlight
            ? "rgba(255, 0, 168, 0.4)"
            : tone === "loss"
              ? "rgba(255, 92, 106, 0.28)"
              : undefined,
        boxShadow: highlight ? `0 0 32px -12px ${MAGENTA}` : undefined,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.24em]"
        style={{ color: tone === "loss" ? "rgba(255, 92, 106, 0.8)" : "#5E5568" }}
      >
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className="font-semibold tabular-nums"
          style={{
            fontSize: 32,
            color: accent ?? "#EDE6F0",
          }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-fg-muted">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Hero code — the single flip-in code card
// ============================================================

type HeroTone = "win" | "loss" | "neutral";

function HeroCode({
  label,
  subtext,
  code,
  tone = "neutral",
}: {
  label: string;
  subtext: string;
  code: string;
  tone?: HeroTone;
}) {
  const borderColor =
    tone === "win"
      ? "rgba(255, 0, 168, 0.35)"
      : tone === "loss"
        ? "rgba(255, 92, 106, 0.4)"
        : undefined;
  return (
    <div className="relative">
      {/* Fracture lines — only on loss. Faint red cracks radiating from
          the card, visible OUTSIDE it as if the card itself has split
          the page. */}
      {tone === "loss" && <FractureLines />}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.6 }}
        className="panel-elevated p-8 md:p-10 relative overflow-hidden text-center"
        style={{
          borderColor,
          // Breathing red aura for loss; static magenta glow for win.
          animation: tone === "loss" ? "crackd-breath 3s ease-in-out infinite" : undefined,
          boxShadow:
            tone === "win"
              ? `0 0 40px -10px ${MAGENTA}`
              : undefined,
        }}
      >
        {/* Loss-only: angled "EXPOSED" stamp in the corner */}
        {tone === "loss" && (
          <div
            className="absolute -right-10 top-5 rotate-[24deg] select-none pointer-events-none"
            aria-hidden
          >
            <span
              className="inline-block px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] border"
              style={{
                color: LOSS_RED,
                borderColor: "rgba(255, 92, 106, 0.55)",
                background: "rgba(255, 92, 106, 0.06)",
                letterSpacing: "0.4em",
              }}
            >
              Exposed
            </span>
          </div>
        )}

        <div className="text-[10px] uppercase tracking-[0.3em] text-fg-muted">
          {label}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 relative">
          {code.split("").map((c, i) => (
            <DigitFlip key={i} char={c} delay={0.3 + i * 0.12} tone={tone} />
          ))}
          {/* Loss-only: a single red scan line sweeps once across the code. */}
          {tone === "loss" && <ScanSweep />}
        </div>

        <div className="mt-6 text-sm text-fg-secondary">{subtext}</div>

        <style>{`
          @keyframes crackd-breath {
            0%, 100% { box-shadow: 0 0 0px -4px rgba(255, 92, 106, 0.0); }
            50%      { box-shadow: 0 0 44px -6px rgba(255, 92, 106, 0.45); }
          }
        `}</style>
      </motion.div>
    </div>
  );
}

/**
 * Faint diagonal fracture lines radiating OUT from roughly where the
 * hero card sits. Rendered behind the card via an absolute-positioned
 * SVG so the card appears to have "cracked" the page.
 */
function FractureLines() {
  const cracks = [
    { d: "M 50% 50% L -20 -30", delay: 1.1 },
    { d: "M 50% 50% L 120% -10", delay: 1.2 },
    { d: "M 50% 50% L -10 110%", delay: 1.3 },
    { d: "M 50% 50% L 110% 120%", delay: 1.05 },
    { d: "M 50% 50% L 50% -40", delay: 1.35 },
    { d: "M 50% 50% L 110% 50%", delay: 1.25 },
  ];
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: "visible" }}
    >
      {cracks.map((c, i) => (
        <motion.path
          key={i}
          d={c.d}
          stroke="rgba(255, 92, 106, 0.28)"
          strokeWidth={1}
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: c.delay, duration: 0.7, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

/**
 * Single red scan line that sweeps horizontally across the digit row
 * once on mount, then disappears — "your code is being scanned and
 * exposed" signal.
 */
function ScanSweep() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      <span
        className="absolute inset-y-0 w-[3px]"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(255,92,106,0.85), transparent)",
          boxShadow: "0 0 14px rgba(255,92,106,0.6)",
          animation: "crackd-scan 1.4s ease-out 1.0s forwards",
          left: "-10%",
          opacity: 0,
        }}
      />
      <style>{`
        @keyframes crackd-scan {
          0%   { left: -10%; opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { left: 110%; opacity: 0; }
        }
      `}</style>
    </span>
  );
}

function DrawCards({ finished }: { finished: S2CGameOver }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <HeroCode
        label="Your code"
        subtext={`${finished.final.playerTwoGuesses.length} guesses against it`}
        code={finished.final.playerOneCode}
      />
      <HeroCode
        label="Their code"
        subtext={`${finished.final.playerOneGuesses.length} guesses against it`}
        code={finished.final.playerTwoCode}
      />
    </div>
  );
}

function DigitFlip({
  char,
  delay,
  tone = "neutral",
}: {
  char: string;
  delay: number;
  tone?: HeroTone;
}) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), delay * 1000 + 500);
    return () => clearTimeout(t);
  }, [delay]);

  const styles =
    tone === "win"
      ? {
          background: "rgba(255, 0, 168, 0.1)",
          borderColor: "rgba(255, 0, 168, 0.4)",
          color: MAGENTA,
          glow: `0 0 28px -6px ${MAGENTA}`,
        }
      : tone === "loss"
        ? {
            background: "rgba(255, 92, 106, 0.08)",
            borderColor: "rgba(255, 92, 106, 0.38)",
            color: LOSS_RED,
            glow: `0 0 28px -8px ${LOSS_RED}`,
          }
        : {
            background: undefined,
            borderColor: undefined,
            color: undefined,
            glow: "none",
          };

  return (
    <motion.span
      initial={{ rotateX: -90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className={`w-16 h-20 md:w-20 md:h-24 grid place-items-center rounded-2xl border font-mono text-4xl md:text-5xl font-semibold ${
        tone === "neutral" ? "bg-ink-elevated border-ink-border text-fg-primary" : ""
      }`}
      style={{
        background: styles.background,
        borderColor: styles.borderColor,
        color: styles.color,
        boxShadow: landed ? styles.glow : "none",
        transition: "box-shadow 400ms",
      }}
    >
      {char || "·"}
    </motion.span>
  );
}

// ============================================================
// Headline with a one-shot shine sweep across the letters
// ============================================================

function Headline({
  text,
  won,
  lost,
}: {
  text: string;
  won: boolean;
  lost: boolean;
}) {
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
        color: won ? MAGENTA : lost ? LOSS_RED : undefined,
        textShadow: lost ? "0 0 60px rgba(255, 92, 106, 0.25)" : undefined,
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
// CountUp — ticks from 0 → value when it mounts
// ============================================================

function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const mv = useMotionValue(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const unsub = mv.on("change", (v) => setShown(Math.round(v)));
    const controls = animate(mv, value, {
      duration: 0.9,
      delay,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => {
      controls.stop();
      unsub();
    };
  }, [mv, value, delay]);

  return <>{shown}</>;
}
