/**
 * Brand — the Cipher Tile mark + the CRACKD wordmark with a magenta D.
 *
 * BrandMark renders the 2×2 code-grid glyph. Filled dots = POTs (right
 * digit right place), outlined = PANs (right digit wrong place). The mark
 * IS the game mechanic.
 *
 * Wordmark renders "CRACKD" with the D highlighted in the brand magenta.
 *
 * BrandLockup combines them in a single horizontal row — use this
 * anywhere a logo normally lives.
 */

const MAGENTA = "#FF00A8";

export function BrandMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* tile frame */}
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="14"
        stroke="currentColor"
        strokeWidth={4}
      />
      {/* POT (filled) */}
      <circle cx="22" cy="22" r="5.5" fill="currentColor" />
      {/* PAN (outlined) */}
      <circle cx="42" cy="22" r="5" stroke="currentColor" strokeWidth={3} />
      {/* PAN (outlined) */}
      <circle cx="22" cy="42" r="5" stroke="currentColor" strokeWidth={3} />
      {/* POT (filled) */}
      <circle cx="42" cy="42" r="5.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  size = 17,
  className,
  dAccent = MAGENTA,
}: {
  size?: number;
  className?: string;
  /** Colour of the final D. Default = brand magenta. */
  dAccent?: string;
}) {
  return (
    <span
      className={`font-semibold leading-none tracking-tight ${className ?? ""}`}
      style={{
        fontSize: size,
        letterSpacing: "-0.02em",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      CRACK<span style={{ color: dAccent }}>D</span>
    </span>
  );
}

/**
 * Horizontal lockup: mark + wordmark. The mark picks up `currentColor`
 * from the parent so it can switch between ink, white, and magenta.
 */
export function BrandLockup({
  markSize = 20,
  wordSize = 16,
  className,
  dAccent,
}: {
  markSize?: number;
  wordSize?: number;
  className?: string;
  dAccent?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 select-none ${className ?? ""}`}
    >
      <BrandMark size={markSize} />
      <Wordmark size={wordSize} dAccent={dAccent} />
    </span>
  );
}

export const BRAND_MAGENTA = MAGENTA;
