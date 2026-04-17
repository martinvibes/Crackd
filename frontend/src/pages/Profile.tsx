/**
 * Profile page — the player's game identity card.
 *
 * Creative choices:
 *   - Hero "player card" with rank badge + win-rate ring
 *   - Visual W/L bar showing the proportion at a glance
 *   - Flame streak counter
 *   - Per-asset earnings tiles with daily allowance progress
 *   - Rank tiers: Rookie → Cracker → Breaker → Vault Master
 *
 * Data comes from the existing /api/player/:wallet endpoint — no
 * new backend work. If wallet not connected, shows a connect prompt.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { api } from "../lib/api";
import { shortAddress } from "../lib/stellar";
import { useWalletStore } from "../store/walletStore";
import { Avatar } from "../components/Avatar";

const MAGENTA = "#FF00A8";

// Rank tiers based on total wins across all modes.
function getRank(wins: number): { title: string; tier: number; next: number } {
  if (wins >= 50) return { title: "Vault Master", tier: 4, next: Infinity };
  if (wins >= 25) return { title: "Breaker", tier: 3, next: 50 };
  if (wins >= 10) return { title: "Cracker", tier: 2, next: 25 };
  if (wins >= 3) return { title: "Player", tier: 1, next: 10 };
  return { title: "Rookie", tier: 0, next: 3 };
}

export default function Profile() {
  const { address, connect, connecting } = useWalletStore();

  const statsQ = useQuery({
    queryKey: ["player", address],
    queryFn: () => api.player(address!),
    enabled: !!address,
    refetchInterval: 30_000,
  });

  if (!address) {
    return <NotConnected connecting={connecting} onConnect={connect} />;
  }

  if (statsQ.isLoading) return <LoadingState />;
  if (statsQ.isError || !statsQ.data) return <ErrorState />;

  const s = statsQ.data;
  const winRate = s.gamesPlayed > 0 ? (s.wins / s.gamesPlayed) * 100 : 0;
  const rank = getRank(s.wins);

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-16">
      {/* Hero player card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative panel-elevated p-6 md:p-8 overflow-hidden"
      >
        {/* Subtle magenta glow behind the card */}
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-[100px] opacity-20 pointer-events-none"
          style={{ background: MAGENTA }}
          aria-hidden
        />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar + win-rate ring wrapper + upload button */}
          <div className="relative shrink-0 group">
            <WinRateRing rate={winRate} tier={rank.tier} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Avatar address={address} size={52} src={s.avatarUrl} className="rounded-xl" />
            </div>
            <AvatarUpload wallet={address} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Username + rank */}
            <div className="flex items-center gap-2 flex-wrap">
              <RankBadge title={rank.title} tier={rank.tier} />
              {s.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                  <StreakFlame />
                  {s.currentStreak} streak
                </span>
              )}
            </div>

            {/* Editable username */}
            <UsernameEditor
              wallet={address}
              currentUsername={s.username}
            />

            {/* Wallet address (below username now) */}
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-fg-muted">
                {shortAddress(address, 6)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                className="text-fg-muted hover:text-fg-primary text-[10px] transition-colors"
                title="Copy full address"
              >
                Copy
              </button>
            </div>

            {/* Quick stats row */}
            <div className="mt-3 flex items-center gap-5 text-sm">
              <span className="text-fg-secondary">
                <strong className="text-fg-primary">{s.gamesPlayed}</strong> games
              </span>
              <span className="text-fg-secondary">
                <strong className="text-fg-primary">{s.wins}</strong>W
                <span className="text-fg-muted mx-1">/</span>
                <strong className="text-fg-primary">{s.losses}</strong>L
              </span>
              <span className="text-fg-secondary">
                Best <strong className="text-fg-primary">{s.bestStreak}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* W/L Bar */}
        {s.gamesPlayed > 0 && (
          <WinLossBar wins={s.wins} losses={s.losses} total={s.gamesPlayed} />
        )}
      </motion.div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Games"
          value={s.gamesPlayed}
          icon={<IconGames />}
        />
        <StatTile
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          icon={<IconTarget />}
          highlight={winRate >= 60}
        />
        <StatTile
          label="Current streak"
          value={s.currentStreak}
          icon={<StreakFlame />}
          highlight={s.currentStreak >= 3}
        />
        <StatTile
          label="Best streak"
          value={s.bestStreak}
          icon={<IconTrophy />}
          highlight={s.bestStreak >= 5}
        />
      </div>

      {/* Rank progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-6 panel p-5"
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
            Rank progress
          </div>
          <RankBadge title={rank.title} tier={rank.tier} />
        </div>
        <div className="mt-3 h-2 rounded-full bg-ink-elevated overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: MAGENTA }}
            initial={{ width: 0 }}
            animate={{
              width:
                rank.next === Infinity
                  ? "100%"
                  : `${Math.min(100, (s.wins / rank.next) * 100)}%`,
            }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
          <span>{s.wins} wins</span>
          <span>
            {rank.next === Infinity
              ? "Max rank"
              : `${rank.next - s.wins} more to next rank`}
          </span>
        </div>
      </motion.div>

      {/* Per-asset earnings */}
      <div className="mt-6">
        <div className="text-[10px] uppercase tracking-[0.24em] text-fg-muted mb-3">
          Earnings by asset
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {s.assets.map((a) => (
            <AssetEarnings key={a.asset} {...a} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

/**
 * Inline username editor. Shows current name (or "Set username") with a
 * pencil icon. Click to edit, Enter or blur to save. Max 20 chars.
 */
function UsernameEditor({
  wallet,
  currentUsername,
}: {
  wallet: string;
  currentUsername: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentUsername ?? "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === currentUsername) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await api.setUsername(wallet, trimmed);
      await qc.invalidateQueries({ queryKey: ["player", wallet] });
    } catch {
      // silently fail — user can retry
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <input
          autoFocus
          maxLength={20}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          disabled={saving}
          className="input py-1 px-2 text-lg font-semibold w-48"
          placeholder="Enter username"
        />
        <button
          onClick={save}
          disabled={saving || !draft.trim()}
          className="btn-primary py-1 px-3 text-xs"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-fg-muted hover:text-fg-primary text-xs"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(currentUsername ?? "");
        setEditing(true);
      }}
      className="mt-2 group flex items-center gap-2 text-left"
    >
      <span className="text-lg md:text-xl font-semibold text-fg-primary">
        {currentUsername ?? "Set username"}
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-fg-muted group-hover:text-accent transition-colors shrink-0"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

/**
 * Small camera overlay on the avatar — clicking opens a file picker.
 * Selected image is resized to 128×128 on a canvas, converted to base64
 * JPEG, and PUT to /api/player/:wallet/avatar. No external storage.
 */
function AvatarUpload({ wallet }: { wallet: string }) {
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      // Cover-crop from center
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, 128, 128);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      try {
        await api.setAvatar(wallet, dataUrl);
        await qc.invalidateQueries({ queryKey: ["player", wallet] });
      } catch {
        // silently fail
      } finally {
        setUploading(false);
      }
    };
    img.src = URL.createObjectURL(file);
  }

  return (
    <label
      className="absolute bottom-0 right-0 h-7 w-7 rounded-full grid place-items-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
      style={{
        background: "rgba(4,0,8,0.85)",
        border: "1px solid rgba(255,0,168,0.4)",
      }}
      title="Change avatar"
    >
      {uploading ? (
        <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FF00A8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      )}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function WinRateRing({ rate, tier }: { rate: number; tier: number }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (rate / 100) * circumference;
  const tierColors = ["#5E5568", "#A69DAD", MAGENTA, MAGENTA, MAGENTA];
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
        <circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="5"
        />
        <motion.circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke={tierColors[tier] ?? MAGENTA}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ delay: 0.3, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{rate.toFixed(0)}%</span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-fg-muted">
          Win rate
        </span>
      </div>
    </div>
  );
}

function WinLossBar({
  wins,
  losses,
  total,
}: {
  wins: number;
  losses: number;
  total: number;
}) {
  const draws = total - wins - losses;
  const wPct = (wins / total) * 100;
  const lPct = (losses / total) * 100;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-fg-muted mb-2">
        <span>W/L record</span>
        <span>
          {wins}W · {losses}L{draws > 0 ? ` · ${draws}D` : ""}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-ink-elevated overflow-hidden flex">
        <motion.div
          className="h-full rounded-l-full"
          style={{ background: MAGENTA }}
          initial={{ width: 0 }}
          animate={{ width: `${wPct}%` }}
          transition={{ delay: 0.5, duration: 0.7 }}
        />
        {draws > 0 && (
          <div
            className="h-full bg-fg-dim"
            style={{ width: `${((draws / total) * 100)}%` }}
          />
        )}
        <motion.div
          className="h-full rounded-r-full"
          style={{ background: "#FF5C6A" }}
          initial={{ width: 0 }}
          animate={{ width: `${lPct}%` }}
          transition={{ delay: 0.6, duration: 0.7 }}
        />
      </div>
    </div>
  );
}

function RankBadge({ title, tier }: { title: string; tier: number }) {
  const bg =
    tier >= 3
      ? "bg-accent/15 border-accent/40 text-accent"
      : tier >= 2
        ? "bg-accent/10 border-accent/25 text-accent/80"
        : "bg-ink-elevated border-ink-border text-fg-secondary";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.24em] font-semibold border ${bg}`}
    >
      {tier >= 3 && <span className="text-accent">✦</span>}
      {title}
    </span>
  );
}

function StatTile({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`panel p-4 ${highlight ? "border-accent/30" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
          {label}
        </span>
        <span className={`w-4 h-4 ${highlight ? "text-accent" : "text-fg-muted"}`}>
          {icon}
        </span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          highlight ? "text-accent" : "text-fg-primary"
        }`}
      >
        {value}
      </div>
    </motion.div>
  );
}

function AssetEarnings({
  asset,
  displayName,
  totalEarned,
  dailyRemaining,
}: {
  asset: string;
  displayName: string;
  totalEarned: number;
  totalEarnedStroops: string;
  dailyRemaining: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="panel p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
            {displayName}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className="text-3xl font-semibold tabular-nums"
              style={{ color: totalEarned > 0 ? MAGENTA : undefined }}
            >
              {totalEarned.toFixed(2)}
            </span>
            <span className="text-xs text-fg-muted">{asset}</span>
          </div>
          <div className="mt-1 text-xs text-fg-muted">earned total</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
            Daily cap left
          </div>
          <div className="mt-1 font-mono text-sm tabular-nums text-fg-secondary">
            {dailyRemaining.toFixed(2)} {asset}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Empty / loading / error states
// ============================================================

function NotConnected({
  connecting,
  onConnect,
}: {
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto px-5 md:px-8 py-20 text-center">
      <div
        className="mx-auto w-16 h-16 rounded-full grid place-items-center"
        style={{
          background: "rgba(255,0,168,0.08)",
          border: "1px solid rgba(255,0,168,0.3)",
        }}
      >
        <IconWallet />
      </div>
      <h2 className="mt-6 text-2xl font-semibold">Connect to see your profile.</h2>
      <p className="mt-3 text-fg-secondary max-w-sm mx-auto">
        Your game stats, earnings, and rank are linked to your wallet. Connect
        one to view your player card.
      </p>
      <button
        onClick={() => onConnect()}
        disabled={connecting}
        className="btn-primary mt-8"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-16">
      <div className="panel-elevated p-8 h-40 animate-pulse rounded-2xl" />
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="panel p-4 h-20 animate-pulse rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="max-w-xl mx-auto px-5 md:px-8 py-20 text-center">
      <div className="text-fg-muted">Couldn't load your profile. Try refreshing.</div>
    </div>
  );
}

// ============================================================
// Icons
// ============================================================

function StreakFlame() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={MAGENTA} aria-hidden>
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-2.52 1.17-5.13 3-7.5.68 1.43 1.75 2.77 3 3.5-.25-3 1.33-6 4-8 .82 2.67 2.17 4.5 3.5 5.5 1.65-1.47 2.5-3.5 2.5-5.5 2.33 2.83 3 5.67 3 8.5 0 4.42-4.03 8-9 8z" />
    </svg>
  );
}

function IconGames() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M12 12h.01M6 12h.01M18 12h.01" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 0 1-14 0V4z" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={MAGENTA} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z" />
      <path d="M16 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" />
    </svg>
  );
}
