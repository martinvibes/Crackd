/**
 * Home — the real one.
 *
 * Evolved from the V4 "Vault Mechanism" direction: tactile industrial,
 * electric magenta on deep ink, blueprint grid as connective tissue.
 * Trimmed hard so the eye always has one thing to focus on.
 *
 * Stolen from V3: the three-act "How it plays" section, and the closing
 * marquee — both re-skinned to V4's palette.
 *
 * Sections:
 *   1. Hero — draggable safe dial, CRACK THE VAULT headline, single CTA
 *   2. How it plays — three acts, card reveal on scroll
 *   3. Modes — four rows, very plain
 *   4. Closing marquee
 *   5. Footer
 */
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import WalletButton from "../components/WalletButton";
import { BrandMark, Wordmark } from "../components/Brand";

const INK = "#040008";
const HOT = "#FF00A8";
const BONE = "#EDE6F0";
const RULE = "rgba(255, 0, 168, 0.18)";

export default function Home() {
  const { data: pools } = useQuery({
    queryKey: ["pool-balances"],
    queryFn: () => api.poolBalances(),
    refetchInterval: 30_000,
  });
  const xlm = pools?.balances.find((b) => b.asset === "XLM")?.balance ?? 0;
  const usdc = pools?.balances.find((b) => b.asset === "USDC")?.balance ?? 0;

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: INK,
        color: BONE,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <Blueprint />
      <Nav />

      <Hero xlm={xlm} usdc={usdc} />
      <HowItPlays />
      <Modes />
      <Marquee />
      <Footer />
    </div>
  );
}

// ============================================================
// Chrome
// ============================================================

function Nav() {
  return (
    <header
      className="fixed top-0 inset-x-0 z-40 backdrop-blur-md"
      style={{
        background: "rgba(4,0,8,0.6)",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 select-none" aria-label="Crackd home">
          <span style={{ color: BONE }}>
            <BrandMark size={22} />
          </span>
          <Wordmark size={17} />
        </Link>
        <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.25em] text-white/60">
          <Link to="/play" className="hidden md:inline hover:text-white transition-colors">Play</Link>
          <Link to="/leaderboard" className="hidden md:inline hover:text-white transition-colors">Winners</Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function Blueprint() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-30"
      aria-hidden
      style={{
        backgroundImage:
          `linear-gradient(to right, ${RULE} 1px, transparent 1px),
           linear-gradient(to bottom, ${RULE} 1px, transparent 1px)`,
        backgroundSize: "88px 88px",
        maskImage:
          "radial-gradient(ellipse 80% 60% at 50% 30%, black 10%, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 60% at 50% 30%, black 10%, transparent 80%)",
      }}
    />
  );
}

// ============================================================
// Hero
// ============================================================

function Hero({ xlm, usdc }: { xlm: number; usdc: number }) {
  return (
    <section className="relative max-w-[1280px] mx-auto px-6 md:px-10 pt-28 md:pt-32 pb-24 md:pb-32">
      <div className="absolute top-24 right-6 md:right-10 text-[10px] uppercase tracking-[0.3em] text-white/30">
        — LAT 00.01 —
      </div>

      <div className="grid grid-cols-12 gap-6 md:gap-10 items-center">
        {/* Left: headline */}
        <div className="col-span-12 md:col-span-5 relative z-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/50"
          >
            <DotPulse /> Mechanism 001 · Testnet live
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-6 font-semibold leading-[0.9] tracking-[-0.04em]"
            style={{ fontSize: "clamp(52px, 7.5vw, 116px)" }}
          >
            CRACK
            <br />
            <span
              style={{
                background: `linear-gradient(180deg, ${BONE} 40%, ${HOT} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              THE
            </span>
            <br />
            VAULT
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mt-6 max-w-md text-base md:text-lg leading-relaxed text-white/70"
          >
            A 1v1 code-breaking game, settled on-chain. Turn the dial. Break
            the code. The contract pays you out instantly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.6 }}
            className="mt-10 flex items-center gap-5"
          >
            <Link
              to="/play"
              className="group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-full text-sm font-semibold tracking-wide transition-transform hover:-translate-y-0.5"
              style={{
                background: HOT,
                color: INK,
                boxShadow: `0 20px 50px -20px ${HOT}`,
              }}
            >
              Open the vault
              <span
                className="h-9 w-9 grid place-items-center rounded-full transition-transform group-hover:translate-x-0.5"
                style={{ background: INK, color: HOT }}
              >
                →
              </span>
            </Link>
            <Link
              to="/leaderboard"
              className="text-sm text-white/70 hover:text-white underline underline-offset-[6px]"
              style={{ textDecorationColor: `${HOT}60` }}
            >
              See winners
            </Link>
          </motion.div>

          {/* Live pool readouts — small, calm */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-12 flex items-center gap-8 text-sm"
          >
            <PoolChip label="XLM pool" value={xlm} />
            <div className="h-8 w-px" style={{ background: RULE }} />
            <PoolChip label="USDC pool" value={usdc} />
          </motion.div>
        </div>

        {/* Right: the dial */}
        <div className="col-span-12 md:col-span-7 flex items-center justify-center min-h-[500px] md:min-h-[640px] relative">
          <SafeDial />
        </div>
      </div>
    </section>
  );
}

function PoolChip({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function DotPulse() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full rounded-full animate-ping"
        style={{ background: HOT }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: HOT }}
      />
    </span>
  );
}

// ============================================================
// Safe dial
// ============================================================

function SafeDial() {
  const rotation = useMotionValue(0);
  const digit = useTransform(rotation, (r) => {
    const n = Math.round(((r % 360) + 360) % 360 / 36) % 10;
    return n;
  });
  const [currentDigit, setCurrentDigit] = useState(0);
  const [locked, setLocked] = useState<number[]>([]);

  useEffect(() => {
    return digit.on("change", setCurrentDigit);
  }, [digit]);

  function lockDigit() {
    if (locked.length >= 4 || locked.includes(currentDigit)) return;
    setLocked((l) => [...l, currentDigit]);
  }
  function reset() {
    setLocked([]);
    rotation.set(0);
  }

  return (
    <div className="relative flex flex-col items-center gap-6 select-none">
      {/* locked slots */}
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-14 h-16 rounded-sm border grid place-items-center font-semibold text-3xl tabular-nums transition-colors"
            style={{
              borderColor: locked[i] !== undefined ? HOT : RULE,
              color: locked[i] !== undefined ? BONE : "rgba(255,255,255,0.2)",
              background:
                locked[i] !== undefined ? "rgba(255,0,168,0.08)" : "transparent",
              boxShadow:
                locked[i] !== undefined
                  ? `0 0 24px -8px ${HOT}`
                  : "none",
            }}
          >
            {locked[i] ?? "—"}
          </div>
        ))}
      </div>

      {/* dial */}
      <motion.div
        style={{ rotate: rotation, cursor: "grab" }}
        whileTap={{ cursor: "grabbing" }}
        onPan={(_, info) => {
          rotation.set(rotation.get() + info.delta.x * 0.8);
        }}
        className="relative w-[320px] h-[320px] md:w-[420px] md:h-[420px] rounded-full grid place-items-center touch-none"
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${HOT}`,
            boxShadow: `0 0 80px -20px ${HOT}, inset 0 0 140px -40px ${HOT}`,
          }}
        />
        {/* tick marks */}
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: "1px",
              height: i % 9 === 0 ? 18 : 8,
              background: i % 9 === 0 ? HOT : "rgba(237,230,240,0.25)",
              transform: `translate(-50%, -50%) rotate(${i * 10}deg) translateY(-${180}px)`,
              transformOrigin: "center",
            }}
          />
        ))}
        {/* digit labels 0-9 */}
        {Array.from({ length: 10 }).map((_, i) => {
          const active = i === currentDigit;
          return (
            <div
              key={i}
              className="absolute font-semibold text-lg tabular-nums"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) rotate(${i * 36}deg) translateY(-155px) rotate(${-i * 36}deg)`,
                color: active ? HOT : "rgba(237,230,240,0.45)",
                transition: "color 120ms",
              }}
            >
              {i}
            </div>
          );
        })}
        {/* inner hub */}
        <div
          className="relative w-32 h-32 rounded-full grid place-items-center"
          style={{ background: INK, border: `1px solid ${RULE}` }}
        >
          <motion.div
            key={currentDigit}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="text-6xl font-semibold"
            style={{ color: HOT }}
          >
            {currentDigit}
          </motion.div>
        </div>
        {/* pointer */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1" aria-hidden>
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: `14px solid ${HOT}`,
            }}
          />
        </div>
      </motion.div>

      {/* hint + actions */}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={lockDigit}
          disabled={locked.length >= 4 || locked.includes(currentDigit)}
          className="px-5 py-2.5 rounded-sm text-sm font-semibold tracking-wide transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: HOT, color: INK }}
        >
          Lock digit
        </button>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-sm text-sm text-white/70 hover:text-white border transition-colors"
          style={{ borderColor: RULE }}
        >
          Reset
        </button>
      </div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/30">
        {locked.length === 0
          ? "drag the dial · lock 4 digits"
          : locked.length < 4
            ? `${locked.length} / 4 locked`
            : "4 / 4 — you set a code"}
      </div>
    </div>
  );
}

// ============================================================
// How it plays — three acts (adapted from V3, magenta-restyled)
// ============================================================

function HowItPlays() {
  const acts = [
    {
      tag: "Act I",
      title: "Set your code.",
      body: "Four digits. No repeats. Yours alone — stored out of reach of the opponent and out of reach of us.",
    },
    {
      tag: "Act II",
      title: "POT or PAN.",
      body: "Every guess is graded. POT = right digit, right place. PAN = right digit, wrong place. Miss = silence.",
    },
    {
      tag: "Act III",
      title: "Crack and collect.",
      body: "Four POTs first and the contract pays out instantly. No forms, no waiting, no customer support.",
    },
  ];

  return (
    <section
      className="relative max-w-[1280px] mx-auto px-6 md:px-10 py-24 md:py-32 border-t"
      style={{ borderColor: RULE }}
    >
      {/* Centered intro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="max-w-3xl mx-auto text-center"
      >
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
          §01 · How it plays
        </div>
        <h2
          className="mt-5 font-semibold leading-[0.95] tracking-[-0.03em]"
          style={{ fontSize: "clamp(44px, 6vw, 84px)" }}
        >
          Four digits. <span style={{ color: HOT }}>One winner.</span>
        </h2>
        <p className="mt-5 text-white/65 text-base md:text-lg max-w-xl mx-auto">
          Three acts. Ten minutes. Settled by a smart contract instead of a
          dispute form.
        </p>
      </motion.div>

      {/* Three acts */}
      <div className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {acts.map((a, i) => (
          <ActCard key={a.tag} i={i} {...a} />
        ))}
      </div>
    </section>
  );
}

function ActCard({
  i,
  tag,
  title,
  body,
}: {
  i: number;
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.75, delay: i * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
      className="group relative p-7 md:p-8 rounded-2xl flex flex-col h-full"
      style={{
        background:
          i === 1 ? "rgba(255,0,168,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${i === 1 ? "rgba(255,0,168,0.3)" : RULE}`,
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="text-7xl md:text-8xl font-semibold leading-none tracking-[-0.04em]"
          style={{ color: i === 1 ? HOT : "rgba(237,230,240,0.14)" }}
        >
          0{i + 1}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.3em] mt-3"
          style={{ color: i === 1 ? HOT : "rgba(237,230,240,0.45)" }}
        >
          {tag}
        </span>
      </div>
      <h3 className="mt-10 md:mt-12 text-2xl md:text-3xl font-semibold tracking-[-0.02em] leading-tight">
        {title}
      </h3>
      <p className="mt-3 text-white/70 leading-relaxed text-[15px]">{body}</p>
    </motion.div>
  );
}

// ============================================================
// Modes
// ============================================================

function Modes() {
  return (
    <section className="relative max-w-[1280px] mx-auto px-6 md:px-10 py-24 md:py-32 border-t" style={{ borderColor: RULE }}>
      <div className="grid grid-cols-12 gap-6 md:gap-10">
        <aside className="col-span-12 md:col-span-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">§02</div>
          <h2
            className="mt-4 font-semibold leading-[0.95] tracking-[-0.03em]"
            style={{ fontSize: "clamp(40px, 5.5vw, 76px)" }}
          >
            Four <span style={{ color: HOT }}>ways</span> in.
          </h2>
        </aside>

        <div className="col-span-12 md:col-span-8">
          <ModeRow
            n="01"
            title="vs AI — free"
            desc="Warm up with The Vault. No wallet, no stake."
            to="/play?mode=vs_ai_free"
          />
          <ModeRow
            n="02"
            title="vs AI — staked"
            desc="Put XLM or USDC down. Crack fast, win up to 2× from the pool."
            to="/play?mode=vs_ai_staked"
            featured
          />
          <ModeRow
            n="03"
            title="Multiplayer — casual"
            desc="Invite a friend. No money, just the code."
            to="/play?mode=pvp_casual"
          />
          <ModeRow
            n="04"
            title="Multiplayer — staked"
            desc="Both players escrow. Winner takes the pot minus 2.5% fee."
            to="/play?mode=pvp_staked"
            featured
            last
          />
        </div>
      </div>
    </section>
  );
}

function ModeRow({
  n,
  title,
  desc,
  to,
  featured,
  last,
}: {
  n: string;
  title: string;
  desc: string;
  to: string;
  featured?: boolean;
  last?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
    >
      <Link
        to={to}
        className={`group grid grid-cols-[60px_1fr_auto] items-center gap-6 py-7 transition-colors ${last ? "" : "border-b"}`}
        style={{ borderColor: RULE }}
      >
        <span
          className="text-4xl md:text-5xl font-semibold leading-none"
          style={{
            color: featured ? HOT : "rgba(237,230,240,0.22)",
          }}
        >
          {n}
        </span>
        <div>
          <div className="text-xl md:text-2xl font-semibold tracking-tight">
            {title}
          </div>
          <div className="mt-1 text-sm text-white/65 max-w-lg">{desc}</div>
        </div>
        <span className="text-sm text-white/55 group-hover:translate-x-1 group-hover:text-white transition-all whitespace-nowrap">
          Open →
        </span>
      </Link>
    </motion.div>
  );
}

// ============================================================
// Closing marquee (from V3, magenta-restyled)
// ============================================================

function Marquee() {
  const words = ["Set it", "Guard it", "Crack it", "On-chain", "No middleman"];
  return (
    <section className="relative py-20 md:py-24 overflow-hidden border-t" style={{ borderColor: RULE }}>
      <div
        className="flex gap-10 whitespace-nowrap"
        style={{ animation: "marquee 20s linear infinite" }}
      >
        {[...words, ...words, ...words].map((w, i) => (
          <span
            key={i}
            className="font-semibold leading-none tracking-[-0.05em]"
            style={{
              fontSize: "clamp(60px, 12vw, 180px)",
              color: i % 2 === 0 ? BONE : HOT,
            }}
          >
            {w}
            <span className="text-white/15 mx-4">✦</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </section>
  );
}

// ============================================================
// Footer
// ============================================================

function Footer() {
  return (
    <footer className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 border-t" style={{ borderColor: RULE }}>
      <div className="flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-[0.28em] text-white/50">
        <span>crack<span style={{ color: HOT }}>d</span> · mechanism 001</span>
        <span>testnet · stellar</span>
        <div className="flex gap-4">
          <Link to="/play" className="hover:text-white">Play</Link>
          <Link to="/leaderboard" className="hover:text-white">Winners</Link>
          <a
            href="https://stellar.expert/explorer/testnet/contract/CAFRPUU36IQQJX5O6X4XTYWQI2X7N5WXK37HUSOA256IEYDDVJGVVTHQ"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Contract ↗
          </a>
        </div>
      </div>
    </footer>
  );
}

