/**
 * Setup — create-or-join card shown once a mode is picked.
 *
 * vs-AI modes show a "Solo mode" explainer on the right.
 * PvP modes show the join-by-invite card instead.
 */
import { useState } from "react";
import type { Asset } from "../../lib/api";
import { BackLink } from "./BackLink";
import { modeLabel, type Mode } from "./ModePicker";

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
        <div className="panel-elevated p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-fg-muted">
            {mode.startsWith("vs_ai") ? "Step 1 of 1" : "Create"}
          </div>
          <div className="mt-1 text-xl font-semibold">
            {mode.startsWith("vs_ai")
              ? "Set your code & play"
              : "Open a multiplayer room"}
          </div>

          {isStaked && (
            <>
              <div className="mt-6 text-[11px] uppercase tracking-[0.18em] text-fg-muted">
                Asset
              </div>
              <div className="mt-2 flex gap-2">
                {assets.map((a) => (
                  <button
                    key={a.symbol}
                    onClick={() => setAsset(a.symbol)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      asset === a.symbol
                        ? "bg-accent text-ink border-accent"
                        : "bg-ink-elevated border-ink-border text-fg-secondary hover:text-fg-primary"
                    }`}
                  >
                    {a.symbol}
                  </button>
                ))}
              </div>

              <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-fg-muted">
                Stake ({asset})
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="input w-32 font-mono tabular-nums"
                />
                <span className="text-fg-muted text-sm">{asset}</span>
              </div>

              {mode === "vs_ai_staked" && (
                <div className="mt-5 p-4 rounded-xl bg-ink border border-ink-border text-xs text-fg-secondary">
                  <div className="font-medium text-fg-primary mb-1">Reward multiplier</div>
                  <div>Crack in 1–3 → <span className="text-accent">2.0x</span></div>
                  <div>Crack in 4–5 → 1.5x</div>
                  <div>Crack in 6–7 → 1.0x</div>
                  <div>Crack in 8+ → 0.75x</div>
                </div>
              )}
            </>
          )}

          <button
            className="btn-primary w-full mt-6"
            disabled={busy || (isStaked && !walletConnected)}
            onClick={() =>
              onCreate(isStaked ? asset : undefined, isStaked ? stake : undefined)
            }
          >
            {busy ? "Preparing…" : isStaked ? "Sign & stake" : "Create game"}
          </button>
          {isStaked && !walletConnected && (
            <div className="text-xs text-fg-muted mt-3 text-center">
              Connect a wallet to stake.
            </div>
          )}
        </div>

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
                {mode === "vs_ai_staked" ? "Sign & stake" : "Create game"}
              </span>{" "}
              to begin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
