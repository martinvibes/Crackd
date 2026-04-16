/**
 * Leaderboard page — two layers:
 *   Podium  — top 3, #1 elevated + magenta, #2/#3 neutral.
 *   Table   — ranks 4-10, desktop grid + mobile compact row.
 *
 * Data comes directly from the CrackdVault contract via the backend's
 * simulateTransaction → fully verifiable, no cache we'd have to trust.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { api, type LeaderboardRow } from "../lib/api";
import { shortAddress } from "../lib/stellar";

const MAGENTA = "#FF00A8";

export default function Leaderboard() {
  const assetsQ = useQuery({ queryKey: ["assets"], queryFn: () => api.assets() });
  const [asset, setAsset] = useState<string>("XLM");

  const lbQ = useQuery({
    queryKey: ["leaderboard", asset],
    queryFn: () => api.leaderboard(asset),
    enabled: !!asset,
    refetchInterval: 60_000,
  });

  const rows = lbQ.data?.leaderboard ?? [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 10);

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10 md:py-16">
      {/* Header */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          On-chain leaderboard
        </div>
        <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-tight">
          The wall of <span className="text-accent">winners.</span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-fg-secondary max-w-xl">
          Every entry is read straight from the CrackdVault contract. No
          database, no cache. Verifiable on{" "}
          <a
            href="https://stellar.expert/explorer/testnet/contract/CAFRPUU36IQQJX5O6X4XTYWQI2X7N5WXK37HUSOA256IEYDDVJGVVTHQ"
            target="_blank"
            rel="noreferrer"
            className="text-fg-primary underline underline-offset-4 decoration-accent/50 hover:decoration-accent"
          >
            Stellar Expert ↗
          </a>
          .
        </p>
      </div>

      {/* Asset tabs */}
      <div className="mt-8 md:mt-10 inline-flex items-center p-1 bg-ink-raised border border-ink-border rounded-xl">
        {assetsQ.data?.assets.map((a) => (
          <button
            key={a.symbol}
            onClick={() => setAsset(a.symbol)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              asset === a.symbol
                ? "bg-accent text-ink"
                : "text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {a.symbol}
          </button>
        ))}
      </div>

      {/* Content */}
      {lbQ.isLoading ? (
        <LoadingSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState asset={asset} />
      ) : (
        <>
          <Podium rows={top3} asset={asset} />
          {rest.length > 0 && <Table rows={rest} asset={asset} />}
        </>
      )}
    </div>
  );
}

// ============================================================
// Podium — top 3
// ============================================================

function Podium({ rows, asset }: { rows: LeaderboardRow[]; asset: string }) {
  const [first, second, third] = [rows[0], rows[1], rows[2]];

  return (
    <div className="mt-10 md:mt-14">
      {/* Mobile: stack in 1-2-3 order, full-width */}
      <div className="md:hidden flex flex-col gap-3">
        {first && <PodiumCard row={first} asset={asset} tone="gold" />}
        {second && <PodiumCard row={second} asset={asset} tone="silver" />}
        {third && <PodiumCard row={third} asset={asset} tone="bronze" />}
      </div>

      {/* Desktop: silver-gold-bronze layout with #1 elevated */}
      <div className="hidden md:grid grid-cols-3 items-end gap-4">
        <div className="pt-10">
          {second && <PodiumCard row={second} asset={asset} tone="silver" />}
        </div>
        <div>
          {first && <PodiumCard row={first} asset={asset} tone="gold" />}
        </div>
        <div className="pt-14">
          {third && <PodiumCard row={third} asset={asset} tone="bronze" />}
        </div>
      </div>
    </div>
  );
}

type PodiumTone = "gold" | "silver" | "bronze";

function PodiumCard({
  row,
  asset,
  tone,
}: {
  row: LeaderboardRow;
  asset: string;
  tone: PodiumTone;
}) {
  const isGold = tone === "gold";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: isGold ? 0.05 : tone === "silver" ? 0.15 : 0.2 }}
      className="relative rounded-2xl p-5 md:p-6 border overflow-hidden"
      style={{
        background: isGold
          ? "linear-gradient(180deg, rgba(255,0,168,0.14), rgba(255,0,168,0.02))"
          : "rgba(255,255,255,0.03)",
        borderColor: isGold ? "rgba(255,0,168,0.4)" : "rgba(255,255,255,0.08)",
        boxShadow: isGold ? `0 30px 60px -25px ${MAGENTA}` : undefined,
      }}
    >
      {/* Rank badge */}
      <div className="flex items-start justify-between">
        <div
          className="inline-flex items-center justify-center rounded-full text-base font-semibold"
          style={{
            width: isGold ? 52 : 40,
            height: isGold ? 52 : 40,
            background: isGold ? MAGENTA : "rgba(237,230,240,0.08)",
            color: isGold ? "#040008" : "#EDE6F0",
            fontSize: isGold ? 20 : 16,
          }}
        >
          {row.rank}
        </div>
        <TrophyMark tone={tone} />
      </div>

      {/* Address */}
      <div className="mt-5 font-mono text-sm md:text-[15px] text-fg-primary truncate">
        {shortAddress(row.player, 6)}
      </div>

      {/* Earned — the hero number */}
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={`font-semibold tabular-nums tracking-[-0.02em] ${
            isGold ? "text-accent" : "text-fg-primary"
          }`}
          style={{ fontSize: isGold ? 40 : 28 }}
        >
          {row.totalEarned.toFixed(2)}
        </span>
        <span className="text-xs text-fg-muted">{asset}</span>
      </div>

      {/* Sub-stats */}
      <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-fg-muted font-mono">
        <span>{row.wins} wins</span>
        <span>·</span>
        <span>Best {row.bestStreak}</span>
      </div>
    </motion.div>
  );
}

function TrophyMark({ tone }: { tone: PodiumTone }) {
  if (tone === "gold") {
    return (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke={MAGENTA}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 0 1-14 0V4z" />
        <path d="M5 6H3a2 2 0 0 0 2 4M19 6h2a2 2 0 0 1-2 4" />
      </svg>
    );
  }
  return (
    <span
      className="text-[10px] uppercase tracking-[0.28em]"
      style={{ color: tone === "silver" ? "rgba(237,230,240,0.75)" : "rgba(237,230,240,0.5)" }}
    >
      {tone === "silver" ? "2nd" : "3rd"}
    </span>
  );
}

// ============================================================
// Table — ranks 4-10
// ============================================================

function Table({ rows, asset }: { rows: LeaderboardRow[]; asset: string }) {
  return (
    <div className="mt-8 md:mt-10">
      <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted mb-3">
        The chase — ranks 4 to {rows.length + 3}
      </div>

      <div className="panel overflow-hidden">
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[56px_1fr_120px_80px_120px] gap-4 px-5 py-3 text-[10px] uppercase tracking-[0.22em] text-fg-muted border-b border-ink-border">
          <div>Rank</div>
          <div>Player</div>
          <div className="text-right">Earned</div>
          <div className="text-right">Wins</div>
          <div className="text-right">Best</div>
        </div>

        {rows.map((row) => (
          <TableRow key={row.player} row={row} asset={asset} />
        ))}
      </div>
    </div>
  );
}

function TableRow({ row, asset }: { row: LeaderboardRow; asset: string }) {
  return (
    <div className="border-b border-ink-border last:border-b-0 hover:bg-ink-elevated transition-colors">
      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-[56px_1fr_120px_80px_120px] gap-4 px-5 py-3.5 items-center">
        <div className="h-7 w-7 rounded-full grid place-items-center text-xs font-semibold bg-ink-elevated text-fg-secondary">
          {row.rank}
        </div>
        <div className="font-mono text-sm text-fg-primary truncate">
          {shortAddress(row.player, 6)}
        </div>
        <div className="text-right font-mono tabular-nums">
          {row.totalEarned.toFixed(2)}{" "}
          <span className="text-fg-muted text-xs">{asset}</span>
        </div>
        <div className="text-right font-mono tabular-nums text-fg-secondary">
          {row.wins}
        </div>
        <div className="text-right font-mono tabular-nums text-fg-secondary">
          {row.bestStreak}
        </div>
      </div>

      {/* Mobile compact */}
      <div className="md:hidden px-4 py-3 flex items-center gap-3">
        <div className="h-7 w-7 rounded-full shrink-0 grid place-items-center text-xs font-semibold bg-ink-elevated text-fg-secondary">
          {row.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-sm text-fg-primary truncate">
              {shortAddress(row.player, 5)}
            </span>
            <span className="font-mono text-sm tabular-nums whitespace-nowrap">
              {row.totalEarned.toFixed(2)}{" "}
              <span className="text-fg-muted text-[10px]">{asset}</span>
            </span>
          </div>
          <div className="mt-0.5 flex gap-3 text-[11px] text-fg-muted font-mono">
            <span>{row.wins} wins</span>
            <span>·</span>
            <span>best {row.bestStreak}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Empty + loading states
// ============================================================

function EmptyState({ asset }: { asset: string }) {
  return (
    <div className="mt-12 md:mt-16 panel-elevated p-10 md:p-14 text-center">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mx-auto"
        style={{
          background: "rgba(255,0,168,0.08)",
          border: "1px solid rgba(255,0,168,0.3)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={MAGENTA}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 0 1-14 0V4z" />
          <path d="M5 6H3a2 2 0 0 0 2 4M19 6h2a2 2 0 0 1-2 4" />
        </svg>
      </div>
      <div className="mt-5 text-xl font-semibold">No winners in {asset} yet.</div>
      <div className="mt-2 text-sm text-fg-secondary">
        The pool is fresh. Be the first to crack it.
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-10 md:mt-14">
      <div className="hidden md:grid grid-cols-3 items-end gap-4">
        <SkeletonCard height="180px" />
        <SkeletonCard height="210px" bright />
        <SkeletonCard height="170px" />
      </div>
      <div className="md:hidden flex flex-col gap-3">
        <SkeletonCard height="130px" bright />
        <SkeletonCard height="130px" />
        <SkeletonCard height="130px" />
      </div>
    </div>
  );
}

function SkeletonCard({ height, bright }: { height: string; bright?: boolean }) {
  return (
    <div
      className="rounded-2xl border animate-pulse"
      style={{
        height,
        background: bright ? "rgba(255,0,168,0.06)" : "rgba(255,255,255,0.02)",
        borderColor: bright ? "rgba(255,0,168,0.2)" : "rgba(255,255,255,0.06)",
      }}
    />
  );
}
