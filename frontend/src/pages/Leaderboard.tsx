/**
 * Leaderboard page. One tab per supported asset.
 * Data comes directly from on-chain via backend proxy — fully verifiable.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { shortAddress } from "../lib/stellar";

export default function Leaderboard() {
  const assetsQ = useQuery({ queryKey: ["assets"], queryFn: () => api.assets() });
  const [asset, setAsset] = useState<string>("XLM");

  const lbQ = useQuery({
    queryKey: ["leaderboard", asset],
    queryFn: () => api.leaderboard(asset),
    enabled: !!asset,
    refetchInterval: 60_000,
  });

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-16">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
            On-chain leaderboard
          </div>
          <h1 className="mt-2 text-4xl md:text-5xl font-display font-bold tracking-tightest">
            The wall of winners.
          </h1>
          <p className="mt-3 text-fg-secondary max-w-xl">
            Every entry is read directly from the CrackdVault contract. No database,
            no cache you can't verify.
          </p>
        </div>
      </div>

      {/* asset tabs */}
      <div className="mt-10 inline-flex items-center p-1 bg-ink-raised border border-ink-border rounded-xl">
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

      <div className="mt-6 panel-elevated overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_120px_80px_120px] gap-4 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-fg-muted border-b border-ink-border">
          <div>Rank</div>
          <div>Player</div>
          <div className="text-right">Earned</div>
          <div className="text-right">Wins</div>
          <div className="text-right">Best streak</div>
        </div>

        {lbQ.isLoading ? (
          <div className="p-8 text-center text-fg-muted">Loading…</div>
        ) : !lbQ.data || lbQ.data.leaderboard.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-fg-muted">No winners in {asset} yet.</div>
            <div className="text-xs text-fg-muted mt-2">Be the first.</div>
          </div>
        ) : (
          lbQ.data.leaderboard.map((r) => (
            <div
              key={r.player}
              className="grid grid-cols-[56px_1fr_120px_80px_120px] gap-4 px-5 py-4 items-center border-b border-ink-border last:border-b-0 hover:bg-ink-elevated transition-colors"
            >
              <div
                className={`h-8 w-8 rounded-full grid place-items-center text-sm font-bold ${
                  r.rank === 1
                    ? "bg-accent text-ink"
                    : r.rank <= 3
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-ink-elevated text-fg-secondary"
                }`}
              >
                {r.rank}
              </div>
              <div className="font-mono text-sm text-fg-primary">
                {shortAddress(r.player, 6)}
              </div>
              <div className="text-right font-mono tabular-nums">
                {r.totalEarned.toFixed(2)}{" "}
                <span className="text-fg-muted text-xs">{asset}</span>
              </div>
              <div className="text-right font-mono tabular-nums text-fg-secondary">
                {r.wins}
              </div>
              <div className="text-right font-mono tabular-nums text-fg-secondary">
                {r.bestStreak}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
