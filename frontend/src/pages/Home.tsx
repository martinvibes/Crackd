/**
 * Home page — hero + live pool + mode cards.
 *
 * Orb lives ONLY here; the rest of the app is clean.
 */
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { api } from "../lib/api";
import { useWalletStore } from "../store/walletStore";
import Orb from "../components/Orb";

export default function Home() {
  const navigate = useNavigate();
  const { address } = useWalletStore();
  const pools = useQuery({
    queryKey: ["pool-balances"],
    queryFn: () => api.poolBalances(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const leaderboard = useQuery({
    queryKey: ["leaderboard", "XLM"],
    queryFn: () => api.leaderboard("XLM"),
    refetchInterval: 60_000,
  });

  const totalXlm = useMemo(
    () => pools.data?.balances.find((b) => b.asset === "XLM")?.balance ?? 0,
    [pools.data],
  );
  const totalUsdc = useMemo(
    () => pools.data?.balances.find((b) => b.asset === "USDC")?.balance ?? 0,
    [pools.data],
  );

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 mask-fade-y" aria-hidden>
          <Orb intensity={0.9} />
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-24 pb-32 md:pt-36 md:pb-48 relative">
          <div className="inline-flex items-center gap-2 chip mb-6 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Live on Stellar testnet
          </div>
          <h1 className="font-display font-bold tracking-tightest text-5xl md:text-7xl lg:text-[88px] leading-[0.95] text-fg-primary text-balance max-w-3xl animate-slide-up">
            Set it. Guard it. <span className="text-accent">Crack it.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-fg-secondary max-w-xl text-balance animate-slide-up">
            A 1v1 code-breaking game settled on-chain. Stake XLM or USDC,
            outsmart the other player, take the pot. No middleman, no trust —
            the contract is the referee.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 animate-slide-up">
            <button className="btn-primary" onClick={() => navigate("/play")}>
              Play now
              <span aria-hidden>→</span>
            </button>
            <Link to="/leaderboard" className="btn-ghost">
              See leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* ============ LIVE POOL BANNER ============ */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 -mt-16 relative z-10">
        <div className="panel-elevated p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <PoolStat label="XLM Vault Pool" value={totalXlm} unit="XLM" loading={pools.isLoading} />
          <PoolStat label="USDC Vault Pool" value={totalUsdc} unit="USDC" loading={pools.isLoading} />
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
              Leader
            </div>
            <div className="mt-2 flex items-center gap-3">
              {leaderboard.data?.leaderboard[0] ? (
                <>
                  <div className="h-9 w-9 rounded-full bg-accent/15 border border-accent/30 grid place-items-center text-accent text-sm font-bold">
                    1
                  </div>
                  <div>
                    <div className="font-mono text-sm text-fg-primary">
                      {leaderboard.data.leaderboard[0].player.slice(0, 6)}…
                      {leaderboard.data.leaderboard[0].player.slice(-4)}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {leaderboard.data.leaderboard[0].totalEarned.toFixed(2)} XLM earned
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-fg-muted text-sm">No winners yet — be the first</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ MODES ============ */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 mt-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">Game modes</div>
            <h2 className="mt-2 text-3xl md:text-4xl font-display font-semibold">
              Pick your playground
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            title="Challenge The Vault"
            kicker="vs AI · free"
            desc="Warm up against our Pidgin-speaking AI. No wallet needed. Perfect for your first try."
            cta="Play for free"
            tone="muted"
            onClick={() => navigate("/play?mode=vs_ai_free")}
          />
          <ModeCard
            title="Challenge The Vault"
            kicker="vs AI · staked"
            desc="Put XLM or USDC on the line. Beat the Vault in 3 guesses and you get 2x your stake from the community pool."
            cta="Stake & play"
            tone="accent"
            onClick={() => {
              if (!address) {
                alert("Connect a wallet to stake");
                return;
              }
              navigate("/play?mode=vs_ai_staked");
            }}
          />
          <ModeCard
            title="Challenge a friend"
            kicker="pvp · casual"
            desc="Two humans, one code each. No stakes, just bragging rights. Invite code shareable."
            cta="Create room"
            tone="muted"
            onClick={() => navigate("/play?mode=pvp_casual")}
          />
          <ModeCard
            title="Duel a stranger"
            kicker="pvp · staked ⭐"
            desc="Both players lock equal stakes in the contract. Winner takes all minus 2.5% protocol fee. Settlement is atomic."
            cta="Open duel"
            tone="accent"
            onClick={() => {
              if (!address) {
                alert("Connect a wallet to stake");
                return;
              }
              navigate("/play?mode=pvp_staked");
            }}
          />
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 mt-24">
        <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">How it works</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-display font-semibold">
          Four digits. Two players. One winner.
        </h2>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Step n="01" title="Set your code">
            Pick a secret 4-digit code (no repeats). Your opponent does the same.
            Neither sees the other's.
          </Step>
          <Step n="02" title="Guess + feedback">
            Take turns guessing. For each guess:{" "}
            <span className="text-accent font-medium">POT</span> = right digit, right place.{" "}
            <span className="text-honey font-medium">PAN</span> = right digit, wrong place.
          </Step>
          <Step n="03" title="Crack & collect">
            First to 4 POTs wins. If staked, the contract pays out instantly. No
            button to click, no waiting.
          </Step>
        </div>
      </section>
    </>
  );
}

function PoolStat({
  label,
  value,
  unit,
  loading,
}: {
  label: string;
  value: number;
  unit: string;
  loading: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <div className="h-9 w-32 rounded-md bg-ink-elevated animate-pulse" />
        ) : (
          <>
            <span className="font-display font-bold text-4xl md:text-5xl tabular-nums">
              {value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
            <span className="font-mono text-sm text-fg-muted">{unit}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ModeCard({
  title,
  kicker,
  desc,
  cta,
  tone,
  onClick,
}: {
  title: string;
  kicker: string;
  desc: string;
  cta: string;
  tone: "muted" | "accent";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left relative overflow-hidden rounded-2xl p-6 md:p-7 transition-all duration-200 ${
        tone === "accent"
          ? "bg-gradient-to-br from-accent-dim to-ink-raised border border-accent/25 hover:border-accent/50"
          : "panel hover:border-ink-border-strong"
      }`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="uppercase tracking-[0.18em] text-fg-muted">{kicker}</span>
        <span
          className={`transition-transform group-hover:translate-x-1 ${tone === "accent" ? "text-accent" : "text-fg-secondary"}`}
        >
          →
        </span>
      </div>
      <div className="mt-4 font-display font-semibold text-2xl text-fg-primary">
        {title}
      </div>
      <div className="mt-2 text-sm text-fg-secondary max-w-sm leading-relaxed">{desc}</div>
      <div
        className={`mt-6 inline-flex items-center gap-2 text-sm font-medium ${tone === "accent" ? "text-accent" : "text-fg-primary"}`}
      >
        {cta}
      </div>
    </button>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-6">
      <div className="font-mono text-xs text-fg-muted tracking-widest">{n}</div>
      <div className="mt-3 font-display font-semibold text-lg">{title}</div>
      <div className="mt-2 text-sm text-fg-secondary leading-relaxed">{children}</div>
    </div>
  );
}
