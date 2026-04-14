/** XLM ↔ stroops conversion. 1 XLM = 10_000_000 stroops. */
export const STROOPS_PER_XLM = 10_000_000;

export function xlmToStroops(xlm: number): bigint {
  if (!Number.isFinite(xlm) || xlm < 0) {
    throw new RangeError(`Invalid XLM amount: ${xlm}`);
  }
  // Multiply via BigInt to avoid floating drift on fractional stroops.
  const stroops = Math.round(xlm * STROOPS_PER_XLM);
  return BigInt(stroops);
}

export function stroopsToXlm(stroops: bigint | number): number {
  const n = typeof stroops === "bigint" ? Number(stroops) : stroops;
  return n / STROOPS_PER_XLM;
}

/** Truncate a Stellar address (G… / C…) for display. */
export function shortAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
