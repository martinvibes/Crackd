/**
 * Logo exploration route. Six directions, rendered at three scales
 * (hero, medium, favicon) so you can see which reads best at any size.
 *
 * Each logo is a single inline SVG so it's zero-bundle-cost, resolution-
 * free, and recolours via `currentColor`.
 *
 * Once a direction is picked, delete the others and move the winning
 * component into `components/Brand.tsx`.
 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const MAGENTA = "#FF00A8";
const BONE = "#EDE6F0";
const INK = "#040008";

// ============================================================
// Logo components. Every one takes a `size` prop and respects
// `currentColor` so the parent controls the hue.
// ============================================================

type LogoProps = { size?: number };

/**
 * 1. Dial Monogram — the C of Crackd IS a combination dial.
 *    The tick mark at 12 o'clock doubles as the letter stem of D.
 */
function LogoDial({ size = 64 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      {/* outer ring with a small gap (makes it read as a C) */}
      <path
        d="M 32 8 A 24 24 0 1 1 10.3 44.5"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* tick marks */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="32"
          y1="10"
          x2="32"
          y2="14"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          transform={`rotate(${deg} 32 32)`}
          opacity={0.55}
        />
      ))}
      {/* centre dot */}
      <circle cx="32" cy="32" r="5" fill="currentColor" />
      {/* pointer at top */}
      <path
        d="M29 4 L32 10 L35 4 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 2. Cracked Ring — a perfect ring, split by a lightning fissure.
 *    Visual pun on "Crack". Works mono at every size.
 */
function LogoCrackedRing({ size = 64 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle
        cx="32"
        cy="32"
        r="24"
        stroke="currentColor"
        strokeWidth={5}
      />
      {/* the crack — cuts through the ring using bg colour */}
      <path
        d="M32 4 L27 26 L35 30 L29 60"
        stroke="var(--logo-bg, #040008)"
        strokeWidth={8}
        strokeLinejoin="miter"
      />
      <path
        d="M32 4 L27 26 L35 30 L29 60"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * 3. Cipher Tile — 4 dots arranged in a 2×2 code grid. Filled dots
 *    are POTs (right place), outlined are PANs (wrong place). Encodes
 *    the core game mechanic right into the mark.
 */
function LogoCipher({ size = 64 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="14"
        stroke="currentColor"
        strokeWidth={4}
      />
      {/* POT filled */}
      <circle cx="22" cy="22" r="5.5" fill="currentColor" />
      {/* PAN outline */}
      <circle cx="42" cy="22" r="5" stroke="currentColor" strokeWidth={3} />
      {/* PAN outline */}
      <circle cx="22" cy="42" r="5" stroke="currentColor" strokeWidth={3} />
      {/* POT filled */}
      <circle cx="42" cy="42" r="5.5" fill="currentColor" />
    </svg>
  );
}

/**
 * 4. Vault Head — padlock shackle + combination dial face.
 *    Literal but unambiguous; good for app-icon contexts.
 */
function LogoVaultHead({ size = 64 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* shackle */}
      <path
        d="M18 26 V18 A14 14 0 0 1 46 18 V26"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* body */}
      <rect
        x="10"
        y="26"
        width="44"
        height="34"
        rx="6"
        stroke="currentColor"
        strokeWidth={4}
      />
      {/* combination dial inside */}
      <circle
        cx="32"
        cy="43"
        r="7"
        stroke="currentColor"
        strokeWidth={3}
      />
      <circle cx="32" cy="43" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * 5. Keyhole D — pure wordmark move. The D in CRACKD is replaced by a
 *    geometric keyhole. Only shown as a stand-alone glyph here.
 */
function LogoKeyholeD({ size = 64 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* D shape */}
      <path
        d="M10 6 H32 A26 26 0 0 1 32 58 H10 Z"
        fill="currentColor"
      />
      {/* keyhole cutout (bg) */}
      <circle cx="30" cy="26" r="6" fill="var(--logo-bg, #040008)" />
      <rect
        x="27"
        y="26"
        width="6"
        height="16"
        fill="var(--logo-bg, #040008)"
      />
    </svg>
  );
}

/**
 * 6. Pot & Flame — literal cooking pot, Pidgin-kitchen metaphor that
 *    powers the game's POT/PAN vocabulary. Most cultural, boldest.
 */
function LogoPot({ size = 64 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* handles */}
      <path
        d="M10 28 h5 M49 28 h5"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* body */}
      <path
        d="M13 28 H51 L48 54 A4 4 0 0 1 44 58 H20 A4 4 0 0 1 16 54 Z"
        fill="currentColor"
      />
      {/* steam */}
      <path
        d="M22 20 C 22 14, 28 14, 28 8 M32 20 C 32 14, 38 14, 38 8 M42 20 C 42 14, 48 14, 48 8"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.55}
      />
    </svg>
  );
}

// ============================================================
// Wordmark — used alongside each logo.
// ============================================================

function Wordmark({
  size = 20,
  accent,
}: {
  size?: number;
  accent?: string;
}) {
  return (
    <span
      className="font-semibold tracking-tight leading-none"
      style={{
        fontSize: size,
        letterSpacing: "-0.02em",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      CRACK
      <span style={{ color: accent ?? "inherit" }}>D</span>
    </span>
  );
}

// ============================================================
// The page
// ============================================================

const LOGOS: Array<{
  id: string;
  name: string;
  concept: string;
  Mark: React.FC<LogoProps>;
}> = [
  {
    id: "dial",
    name: "Dial Monogram",
    concept:
      "The C of Crackd is a combination dial — reads as both a letter and the core vault mechanic.",
    Mark: LogoDial,
  },
  {
    id: "cracked-ring",
    name: "Cracked Ring",
    concept:
      "A ring split by a lightning fissure. Pure visual pun, works monochrome at any size.",
    Mark: LogoCrackedRing,
  },
  {
    id: "cipher",
    name: "Cipher Tile",
    concept:
      "2×2 code grid — filled dots are POTs, outlined are PANs. The mark IS the game mechanic.",
    Mark: LogoCipher,
  },
  {
    id: "vault-head",
    name: "Vault Head",
    concept:
      "Literal padlock with a dial face. Best for app icons and OG images — instantly readable.",
    Mark: LogoVaultHead,
  },
  {
    id: "keyhole-d",
    name: "Keyhole D",
    concept:
      "The D in the wordmark becomes a keyhole. Pure typographic move, no stand-alone glyph.",
    Mark: LogoKeyholeD,
  },
  {
    id: "pot",
    name: "Pot & Steam",
    concept:
      "Literal cooking pot — the Pidgin kitchen metaphor that powers POT/PAN. Boldest cultural call.",
    Mark: LogoPot,
  },
];

export default function Logos() {
  return (
    <div
      className="min-h-screen relative"
      style={{
        background: INK,
        color: BONE,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50 hover:text-white transition-colors"
        >
          <span
            className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-white/15 group-hover:border-white/40 transition-colors"
            aria-hidden
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M7.5 2 3.5 6l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Go to home
        </Link>

        <div className="mt-10 text-[10px] uppercase tracking-[0.28em] text-white/40">
          Brand review — pick a mark
        </div>
        <h1
          className="mt-4 font-semibold leading-[0.95] tracking-[-0.03em]"
          style={{ fontSize: "clamp(44px, 6vw, 88px)" }}
        >
          One of these becomes{" "}
          <span style={{ color: MAGENTA }}>Crackd.</span>
        </h1>
        <p className="mt-5 max-w-xl text-white/70 text-base md:text-lg">
          Each option is shown at three sizes so you can see how it holds up in
          a hero, a nav bar, and a tiny browser tab. Mono-first by design — we
          pick one colour behaviour after picking the shape.
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {LOGOS.map((logo, i) => (
            <motion.div
              key={logo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
            >
              <LogoCard logo={logo} />
            </motion.div>
          ))}
        </div>

        <div className="mt-14 p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">
            Tell me which to ship
          </div>
          <p className="mt-3 text-white/80">
            Reply with the name (e.g. "go with Dial Monogram") and I'll wire it
            everywhere: top-nav, favicon, OG image, Game Studio Hub avatar.
          </p>
        </div>
      </div>
    </div>
  );
}

function LogoCard({
  logo,
}: {
  logo: {
    id: string;
    name: string;
    concept: string;
    Mark: React.FC<LogoProps>;
  };
}) {
  const { Mark } = logo;
  return (
    <div
      className="relative rounded-2xl border p-6 md:p-8 transition-all hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
        ["--logo-bg" as string]: "#040008",
      }}
    >
      {/* Hero size */}
      <div
        className="relative flex items-center justify-center h-48 rounded-xl overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,0,168,0.08), transparent 70%)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ color: BONE }}>
          <Mark size={104} />
        </div>
        <div
          className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.28em]"
          style={{ color: "rgba(237,230,240,0.45)" }}
        >
          {logo.name}
        </div>
      </div>

      {/* Application strip */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {/* wordmark + mark (nav size) */}
        <div
          className="rounded-lg px-3 py-3 flex items-center gap-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ color: MAGENTA }}>
            <Mark size={20} />
          </span>
          <Wordmark size={15} accent={MAGENTA} />
        </div>

        {/* favicon on white */}
        <div
          className="rounded-lg p-3 flex items-center justify-center"
          style={{
            background: BONE,
            ["--logo-bg" as string]: BONE,
            color: INK,
          }}
        >
          <Mark size={28} />
        </div>

        {/* favicon on magenta */}
        <div
          className="rounded-lg p-3 flex items-center justify-center"
          style={{
            background: MAGENTA,
            ["--logo-bg" as string]: MAGENTA,
            color: INK,
          }}
        >
          <Mark size={28} />
        </div>
      </div>

      {/* description */}
      <div className="mt-5">
        <div className="text-base font-semibold tracking-tight">{logo.name}</div>
        <p className="mt-1.5 text-sm text-white/65 leading-relaxed">
          {logo.concept}
        </p>
      </div>
    </div>
  );
}
