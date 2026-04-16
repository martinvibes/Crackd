/**
 * Setup — create-or-join card shown once a mode is picked.
 *
 * vs-AI modes show a "Solo mode" explainer on the right.
 * PvP modes show the join-by-invite card instead.
 */
import { useMemo, useState } from "react";
import type { Asset } from "../../lib/api";
import { BackLink } from "./BackLink";
import { modeLabel, type Mode } from "./ModePicker";

const STAKE_PRESETS = [1, 5, 10, 25] as const;

/**
 * Reward multiplier tiers — kept in sync with the on-chain rewards.rs
 * in crackd-vault. If the contract changes, update here too.
 */
const MULTIPLIER_TIERS: Array<{
  label: string;
  range: string;
  factor: number;
  minGuesses: number;
  maxGuesses: number;
}> = [
  { label: "Lightning", range: "1–3", factor: 2.0, minGuesses: 1, maxGuesses: 3 },
  { label: "Sharp", range: "4–5", factor: 1.5, minGuesses: 4, maxGuesses: 5 },
  { label: "Par", range: "6–7", factor: 1.0, minGuesses: 6, maxGuesses: 7 },
  { label: "Lucky", range: "8+", factor: 0.75, minGuesses: 8, maxGuesses: 99 },
];

export function SetupPanel({
  mode,
  assets,
  busy,
  walletConnected,
  invitePrefill,
  onInviteChange,
  onCreate,
  onJoin,
  onBack,
}: {
  mode: Mode;
  assets: Asset[];
  busy: boolean;
  walletConnected: boolean;
  invitePrefill: string;
  onInviteChange: (v: string) => void;
  onCreate: (asset?: string, stake?: number) => void;
  onJoin: (invite: string) => void;
  onBack: () => void;
}) {
  const [asset, setAsset] = useState("XLM");
  const [stake, setStake] = useState(1);

  const isStaked = mode === "vs_ai_staked" || mode === "pvp_staked";
  const canJoin = mode === "pvp_casual" || mode === "pvp_staked";

  // Best-case bonus preview (assumes cracking in the top tier → 2.0×).
  const bestBonus = useMemo(() => stake * 2, [stake]);

  return (
    <div className="animate-fade-in">
      <BackLink label="Change mode" onClick={onBack} />
      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-fg-muted">
        {modeLabel(mode)}
      </div>
      <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-[-0.03em]">
        {mode.startsWith("vs_ai") ? "Face The Vault." : "Open a multiplayer match."}
      </h1>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ---- create ---- */}
        {mode === "vs_ai_staked" ? (
          <VaultLockCard
            assets={assets}
            asset={asset}
            setAsset={setAsset}
            stake={stake}
            setStake={setStake}
            bestBonus={bestBonus}
            walletConnected={walletConnected}
            busy={busy}
            onSubmit={() => onCreate(asset, stake)}
          />
        ) : (
          <div className="panel-elevated p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-fg-muted">
              {mode.startsWith("vs_ai") ? "Step 1 of 1" : "Create"}
            </div>
            <div className="mt-1 text-xl font-semibold">
              {mode.startsWith("vs_ai")
                ? "Set your code & play"
                : "Open a multiplayer room"}
            </div>

            <button
              className="btn-primary w-full mt-6"
              disabled={busy}
              onClick={() => onCreate()}
            >
              {busy ? "Preparing…" : "Create game"}
            </button>
          </div>
        )}

        {/* ---- join OR solo-mode explainer ---- */}
        {canJoin ? (
          <div className="panel-elevated p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-fg-muted">Join</div>
            <div className="mt-1 text-xl font-semibold">Paste an invite</div>
            <div className="mt-6">
              <label className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">
                Invite code or full game id
              </label>
              <input
                className="input w-full mt-2 font-mono"
                placeholder="e.g. 7F3A2B  or  full-uuid"
                value={invitePrefill}
                onChange={(e) => onInviteChange(e.target.value)}
              />
            </div>
            <button
              className="btn-ghost w-full mt-6"
              disabled={busy || !invitePrefill.trim()}
              onClick={() => onJoin(invitePrefill.trim())}
            >
              {busy ? "Joining…" : "Join match"}
            </button>
          </div>
        ) : (
          <div className="panel p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-fg-muted">
              Solo mode
            </div>
            <div className="mt-1 text-xl font-semibold">Just you vs The Vault</div>
            <p className="mt-3 text-sm text-fg-secondary leading-relaxed">
              No one to invite — the Vault is your opponent. Hit{" "}
              <span className="text-accent">
                {mode === "vs_ai_staked" ? "Sign & lock" : "Create game"}
              </span>{" "}
              to begin.
            </p>
            {mode === "vs_ai_staked" && <MultiplierTiers stake={stake} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Staked "Vault Lock" card — the creative moment
// ============================================================

function VaultLockCard({
  assets,
  asset,
  setAsset,
  stake,
  setStake,
  bestBonus,
  walletConnected,
  busy,
  onSubmit,
}: {
  assets: Asset[];
  asset: string;
  setAsset: (s: string) => void;
  stake: number;
  setStake: (n: number) => void;
  bestBonus: number;
  walletConnected: boolean;
  busy: boolean;
  onSubmit: () => void;
}) {
  const safeStake = stake > 0 ? stake : 1;
  return (
    <div
      className="panel-elevated p-6 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,0,168,0.06) 0%, rgba(255,255,255,0.02) 60%)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
            Vault lock
          </div>
          <div className="mt-1 text-xl font-semibold">Stake your entry.</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
            Best case
          </div>
          <div
            className="mt-0.5 font-semibold tabular-nums"
            style={{ fontSize: 22, color: "#FF00A8" }}
          >
            +{bestBonus.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
            <span className="text-xs text-fg-muted">{asset}</span>
          </div>
        </div>
      </div>

      {/* Asset pills */}
      <div className="mt-5 text-[10px] uppercase tracking-[0.24em] text-fg-muted">
        Asset
      </div>
      <div className="mt-2 flex gap-2">
        {assets.map((a) => (
          <button
            key={a.symbol}
            onClick={() => setAsset(a.symbol)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              asset === a.symbol
                ? "bg-accent text-ink border-accent"
                : "bg-ink-elevated border-ink-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {a.symbol}
          </button>
        ))}
      </div>

      {/* Stake: preset chips + custom input */}
      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
          Stake
        </span>
        <span className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
          {asset}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(4,auto)_1fr] gap-2 items-center">
        {STAKE_PRESETS.map((amt) => (
          <button
            key={amt}
            onClick={() => setStake(amt)}
            className={`px-3 py-2 rounded-lg text-sm font-mono tabular-nums border transition-colors ${
              stake === amt
                ? "bg-accent/15 border-accent/50 text-accent"
                : "bg-ink-elevated border-ink-border text-fg-secondary hover:text-fg-primary"
            }`}
          >
            {amt}
          </button>
        ))}
        <input
          type="number"
          min={1}
          step={1}
          value={safeStake}
          onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
          className="input font-mono tabular-nums"
          aria-label="Custom stake"
        />
      </div>

      <MultiplierTiers stake={safeStake} />

      {/* CTA */}
      <button
        className="btn-primary w-full mt-6 relative overflow-hidden group"
        disabled={busy || !walletConnected}
        onClick={onSubmit}
      >
        {!busy && walletConnected && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              boxShadow: "0 0 0 0 rgba(255,0,168,0.55)",
              animation: "crackd-vault-pulse 2.2s ease-out infinite",
            }}
          />
        )}
        <span className="relative">
          {busy
            ? "Signing in your wallet…"
            : !walletConnected
              ? "Connect a wallet to stake"
              : `Sign & lock ${safeStake} ${asset}`}
        </span>
      </button>
      {!walletConnected && (
        <div className="text-xs text-fg-muted mt-3 text-center">
          Connect a wallet from the top-right to stake.
        </div>
      )}

      <style>{`
        @keyframes crackd-vault-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(255,0,168,0.55); }
          70%  { box-shadow: 0 0 0 18px rgba(255,0,168,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,0,168,0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Live reward multiplier visualization. Shows 4 tiers as horizontal
 * pills with the "best-case crack-in-3" bonus value per tier.
 */
function MultiplierTiers({ stake }: { stake: number }) {
  return (
    <div className="mt-5 rounded-xl border border-ink-border bg-ink/50 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
          Reward per speed
        </span>
        <span className="text-[10px] uppercase tracking-[0.24em] text-fg-muted">
          If you stake {stake}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {MULTIPLIER_TIERS.map((t, i) => {
          const payout = +(stake * t.factor).toFixed(2);
          const isTop = i === 0;
          return (
            <div
              key={t.range}
              className={`rounded-lg px-2 py-2 border text-center ${
                isTop ? "bg-accent/10 border-accent/30" : "bg-ink-elevated border-ink-border"
              }`}
            >
              <div className="text-[9px] uppercase tracking-[0.22em] text-fg-muted">
                {t.range}
              </div>
              <div
                className={`mt-1 text-sm font-semibold tabular-nums ${
                  isTop ? "text-accent" : "text-fg-primary"
                }`}
              >
                {t.factor}×
              </div>
              <div className="text-[10px] text-fg-muted tabular-nums mt-0.5">
                +{payout}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
