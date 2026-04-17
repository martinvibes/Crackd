/**
 * Deterministic gradient avatar generated from a wallet address.
 *
 * Two colours are derived by hashing segments of the address into
 * hue values. Same wallet = same avatar every time, no storage needed,
 * no external service, zero bundle cost.
 *
 * Renders as an inline SVG so it scales to any size via className.
 */
function hashSegment(str: string, start: number, len: number): number {
  let hash = 0;
  for (let i = start; i < start + len && i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function Avatar({
  address,
  size = 48,
  className,
  src,
}: {
  address: string;
  size?: number;
  className?: string;
  /** If provided, renders the uploaded image instead of the generated gradient. */
  src?: string | null;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        width={size}
        height={size}
        className={`rounded-xl object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const h1 = hashSegment(address, 0, 14) % 360;
  const h2 = hashSegment(address, 14, 14) % 360;
  const s = 65 + (hashSegment(address, 28, 10) % 25); // 65-90%
  const initial = address.startsWith("G")
    ? address[1] ?? "?"
    : address[0] ?? "?";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={`av-${address.slice(0, 8)}`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor={`hsl(${h1}, ${s}%, 55%)`} />
          <stop offset="100%" stopColor={`hsl(${h2}, ${s}%, 45%)`} />
        </linearGradient>
      </defs>
      <rect
        width="48"
        height="48"
        rx="14"
        fill={`url(#av-${address.slice(0, 8)})`}
      />
      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.85)"
        fontSize="20"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {initial.toUpperCase()}
      </text>
    </svg>
  );
}
