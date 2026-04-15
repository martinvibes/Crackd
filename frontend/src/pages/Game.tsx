/**
 * Game page. State machine: mode_pick → (creating/staking) → lobby
 * → setting_codes → active → finished.
 *
 * The backend holds authoritative state; we render the `view` blob
 * we receive over the socket. Every player-initiated event goes through
 * socket emit helpers in `useGameSocket`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWalletStore } from "../store/walletStore";
import { useGameStore } from "../store/gameStore";
import { useQuery } from "@tanstack/react-query";
import { api, type Asset } from "../lib/api";
import {
  emitCancelGame,
  emitChat,
  emitCreateGame,
  emitJoinGame,
  emitMakeGuess,
  emitSetCode,
  useGameSocket,
} from "../hooks/useGameSocket";
import {
  buildDuelCreateTx,
  buildDuelJoinTx,
  buildVaultStakeTx,
  shortAddress,
  toStroops,
} from "../lib/stellar";
import { signTransaction } from "../lib/wallet";

type Mode = "vs_ai_free" | "vs_ai_staked" | "pvp_casual" | "pvp_staked";
type Stage = "mode_pick" | "setup" | "lobby" | "setting_codes" | "active" | "finished";

export default function Game() {
  useGameSocket(); // attach listeners

  const [sp, setSp] = useSearchParams();
  const modeParam = sp.get("mode") as Mode | null;
  const inviteParam = sp.get("invite");
  const navigate = useNavigate();
  const { address } = useWalletStore();
  const view = useGameStore((s) => s.view);
  const finished = useGameStore((s) => s.finished);
  const reset = useGameStore((s) => s.reset);
  const tauntLine = useGameStore((s) => s.tauntLine);

  const assetsQ = useQuery({ queryKey: ["assets"], queryFn: () => api.assets() });

  const [mode, setMode] = useState<Mode | null>(modeParam);
  const [gameId, setGameId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinInviteInput, setJoinInviteInput] = useState(inviteParam ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Clear store when we unmount the page
  useEffect(() => () => reset(), [reset]);

  // Keep mode state in sync with URL — so browser back / "Change mode"
  // button both work via the ?mode= query param.
  useEffect(() => {
    setMode(modeParam);
  }, [modeParam]);

  // Shared helper: go back to mode picker (or previous stage as needed).
  function goBackToModePicker() {
    reset();
    setGameId(null);
    setInviteCode(null);
    setMode(null);
    setSp({});
  }

  const stage: Stage = useMemo(() => {
    if (finished) return "finished";
    if (!mode) return "mode_pick";
    if (!gameId) return "setup";
    if (!view) return "lobby";
    if (view.status === "lobby") return "lobby";
    if (view.status === "setting_codes") return "setting_codes";
    if (view.status === "active") return "active";
    if (view.status === "finished") return "finished";
    return "lobby";
  }, [mode, gameId, view, finished]);

  // --------- actions ---------

  async function handleCreate(asset?: string, stakeXlm?: number) {
    if (!mode) return;
    setBusy(true);
    setErr(null);
    try {
      // Anonymous wallet for casual/free modes when not connected.
      const wallet = address ?? generateAnon();

      let signedXdr: string | undefined;
      if (mode === "vs_ai_staked" || mode === "pvp_staked") {
        if (!address) throw new Error("Connect a wallet to stake");
        const chosen = assetsQ.data?.assets.find((a) => a.symbol === asset);
        if (!chosen) throw new Error("Pick an asset");
        const stroops = toStroops(stakeXlm ?? 0);
        const xdr =
          mode === "vs_ai_staked"
            ? await buildVaultStakeTx(address, chosen.sac, stroops)
            : await buildDuelCreateTx(address, chosen.sac, stroops);
        const sig = await signTransaction(xdr);
        signedXdr = sig.signedXdr;
      }

      const ack = await emitCreateGame({
        walletAddress: wallet,
        mode,
        asset,
        stakeStroops:
          stakeXlm !== undefined ? toStroops(stakeXlm).toString() : undefined,
        signedXdr,
      });
      if (ack.error || !ack.gameId) throw new Error(ack.error || "create failed");
      setGameId(ack.gameId);
      setInviteCode(ack.gameId.slice(-6).toUpperCase());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(invite: string) {
    if (!mode) return;
    setBusy(true);
    setErr(null);
    try {
      // invite code is the last 6 hex chars of a gameId; user may paste full uuid too
      const full = invite.includes("-") ? invite : await lookupGameIdFromInvite(invite);
      if (!full) throw new Error("Invite not found");

      const wallet = address ?? generateAnon();
      let signedXdr: string | undefined;

      if (mode === "pvp_staked") {
        if (!address) throw new Error("Connect a wallet to stake");
        // player two signs a join_game against the contract game id (different from our backend gameId)
        // For MVP: assume backend returns the contract_game_id; fetch game state first.
        const gs = (await api.game(full)) as { contractGameId?: string | null };
        if (!gs.contractGameId) throw new Error("Contract game id missing");
        const xdr = await buildDuelJoinTx(address, gs.contractGameId);
        const sig = await signTransaction(xdr);
        signedXdr = sig.signedXdr;
      }

      const ack = await emitJoinGame({ gameId: full, walletAddress: wallet, signedXdr });
      if (!ack.ok) throw new Error(ack.error || "join failed");
      setGameId(full);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ----- render by stage -----

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-16">
      {err && <ErrorBar message={err} onClose={() => setErr(null)} />}

      {stage === "mode_pick" && (
        <ModePicker
          onPick={(m) => {
            setMode(m);
            setSp({ mode: m });
          }}
        />
      )}

      {stage === "setup" && mode && (
        <SetupPanel
          mode={mode}
          assets={assetsQ.data?.assets ?? []}
          busy={busy}
          walletConnected={!!address}
          invitePrefill={joinInviteInput}
          onInviteChange={setJoinInviteInput}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onBack={goBackToModePicker}
        />
      )}

      {stage === "lobby" && mode && gameId && (
        <LobbyPanel
          inviteCode={inviteCode ?? gameId.slice(-6).toUpperCase()}
          mode={mode}
          onCancel={async () => {
            const wallet = address ?? "";
            await emitCancelGame({ gameId, walletAddress: wallet });
            setGameId(null);
            setInviteCode(null);
            setMode(null);
            navigate("/play");
          }}
        />
      )}

      {(stage === "setting_codes" || stage === "active") && gameId && view && (
        <BoardPanel
          gameId={gameId}
          walletAddress={(address ?? view.youAre) as string}
          view={view}
          tauntLine={tauntLine}
          onSetCode={async (code) =>
            emitSetCode({
              gameId,
              walletAddress: (address ?? view.youAre) as string,
              code,
            })
          }
          onGuess={async (guess) =>
            emitMakeGuess({
              gameId,
              walletAddress: (address ?? view.youAre) as string,
              guess,
            })
          }
          onSendChat={(message) =>
            emitChat({
              gameId,
              walletAddress: (address ?? view.youAre) as string,
              message,
            })
          }
        />
      )}

      {stage === "finished" && finished && (
        <FinishedPanel
          finished={finished}
          me={address ?? (view?.youAre as string | undefined)}
          onPlayAgain={() => {
            reset();
            setGameId(null);
            setInviteCode(null);
            setMode(null);
            navigate("/play");
          }}
        />
      )}
    </div>
  );
}

// ------------------------- Sub-components -------------------------

/**
 * Small "← Change mode" link that sits above every in-flight panel so
 * the user never has to reach for the browser back button.
 */
function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-fg-muted hover:text-accent transition-colors"
    >
      <span
        className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-ink-border group-hover:border-accent/40 transition-colors"
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
      {label}
    </button>
  );
}

function ErrorBar({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="mb-6 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center justify-between">
      <span>{message}</span>
      <button onClick={onClose} className="text-danger/80 hover:text-danger">
        ✕
      </button>
    </div>
  );
}

function ModePicker({ onPick }: { onPick: (m: Mode) => void }) {
  const cards: Array<{
    m: Mode;
    t: string;
    d: string;
    icon: React.ReactNode;
    staked?: boolean;
  }> = [
    {
      m: "vs_ai_free",
      t: "vs AI · free",
      d: "No wallet, no stake. Warm up.",
      icon: <IconSoloDial />,
    },
    {
      m: "vs_ai_staked",
      t: "vs AI · staked",
      d: "Pay to play. Win up to 2× from the pool.",
      icon: <IconStakedDial />,
      staked: true,
    },
    {
      m: "pvp_casual",
      t: "Multiplayer · casual",
      d: "Challenge a friend. No money.",
      icon: <IconDuo />,
    },
    {
      m: "pvp_staked",
      t: "Multiplayer · staked",
      d: "1v1, winner takes the pot. 2.5% fee.",
      icon: <IconStakedDuo />,
      staked: true,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
        Start a game
      </div>
      <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-[-0.03em]">
        Pick how you want to play.
      </h1>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map(({ m, t, d, icon, staked }) => (
          <button
            key={m}
            onClick={() => onPick(m)}
            className={`group relative text-left p-5 md:p-6 rounded-2xl border bg-ink-raised transition-all hover:-translate-y-0.5 hover:bg-ink-elevated ${
              staked
                ? "border-accent/20 hover:border-accent/45"
                : "border-ink-border hover:border-ink-border-strong"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${
                  staked
                    ? "bg-accent/10 text-accent group-hover:bg-accent/15"
                    : "bg-ink-elevated text-fg-secondary group-hover:text-fg-primary"
                }`}
              >
                {icon}
              </span>
              {staked ? (
                <span className="text-[9px] uppercase tracking-[0.24em] text-accent/80 pt-1">
                  Real stakes
                </span>
              ) : (
                <span className="text-[9px] uppercase tracking-[0.24em] text-fg-muted pt-1">
                  No wager
                </span>
              )}
            </div>

            <div className="mt-6 text-xs uppercase tracking-[0.2em] text-fg-muted">
              {t}
            </div>
            <div className="mt-1.5 text-base md:text-[17px] font-medium text-fg-primary leading-snug">
              {d}
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-fg-secondary group-hover:text-fg-primary transition-colors">
              Start
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Mode icons — geometric glyphs that riff on the home page's dial.
// ============================================================

function IconSoloDial() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <line
        x1="12"
        y1="3"
        x2="12"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStakedDial() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="13" r="7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="13" r="2" fill="currentColor" />
      <rect
        x="17"
        y="3"
        width="5"
        height="5"
        fill="currentColor"
        transform="rotate(45 19.5 5.5)"
      />
    </svg>
  );
}

function IconDuo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconStakedDuo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="14" r="4.8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="14" r="4.8" stroke="currentColor" strokeWidth="1.6" />
      <rect
        x="17.5"
        y="3"
        width="4.5"
        height="4.5"
        fill="currentColor"
        transform="rotate(45 19.75 5.25)"
      />
    </svg>
  );
}

function SetupPanel({
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
      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-fg-muted">{modeLabel(mode)}</div>
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

        {/* ---- join ---- */}
        {canJoin ? (
          <div className="panel-elevated p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-fg-muted">Join</div>
            <div className="mt-1 text-xl font-display font-semibold">Paste an invite</div>
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
              {busy ? "Joining…" : "Join duel"}
            </button>
          </div>
        ) : (
          <div className="panel p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-fg-muted">
              Solo mode
            </div>
            <div className="mt-1 text-xl font-semibold">Just you vs The Vault</div>
            <p className="mt-3 text-sm text-fg-secondary leading-relaxed">
              No one to invite — the Vault is your opponent. Hit <span className="text-accent">{mode === "vs_ai_staked" ? "Sign & stake" : "Create game"}</span> to begin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LobbyPanel({
  inviteCode,
  mode,
  onCancel,
}: {
  inviteCode: string;
  mode: Mode;
  onCancel: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <BackLink label="Leave lobby" onClick={onCancel} />
      <div className="mt-6 panel-elevated p-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
          {modeLabel(mode)} · Waiting
        </div>
        <div className="mt-3 text-2xl font-semibold">
          Share this invite.
        </div>
      <div className="mt-6 inline-flex items-center gap-3 px-5 py-4 rounded-xl bg-ink border border-ink-border">
        <span className="font-mono text-3xl tracking-[0.3em] text-accent">{inviteCode}</span>
        <button
          className="btn-ghost py-1.5"
          onClick={() => navigator.clipboard.writeText(inviteCode)}
        >
          Copy
        </button>
      </div>
      <div className="mt-8 text-xs text-fg-muted">
        Waiting for opponent to join…{" "}
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 bg-accent rounded-full animate-pulse" />
          live
        </span>
      </div>
      <button onClick={onCancel} className="btn-ghost mt-6">
        Cancel
      </button>
      </div>
    </div>
  );
}

// --- Board: the actual game ---

function BoardPanel({
  gameId,
  walletAddress,
  view,
  tauntLine,
  onSetCode,
  onGuess,
  onSendChat,
}: {
  gameId: string;
  walletAddress: string;
  view: import("../lib/socket").SafeGameView;
  tauntLine: string | null;
  onSetCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onGuess: (guess: string) => Promise<{ ok: boolean; error?: string }>;
  onSendChat: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needsToSetCode = view.status === "setting_codes" && !view.yourCode;
  const isYourTurn = view.currentTurn === view.you && view.status === "active";

  async function submit() {
    const code = draft.replace(/\D/g, "").slice(0, 4);
    if (code.length !== 4) {
      setError("Enter 4 digits");
      return;
    }
    if (new Set(code.split("")).size !== 4) {
      setError("No repeated digits");
      return;
    }
    setError(null);
    const action = needsToSetCode ? onSetCode(code) : onGuess(code);
    const r = await action;
    if (!r.ok) setError(r.error ?? "Try again");
    else setDraft("");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 animate-fade-in">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
              Game {gameId.slice(0, 6)}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {needsToSetCode
                ? "Set your secret code"
                : isYourTurn
                  ? "Your move."
                  : "Opponent thinking…"}
            </div>
          </div>
          <TurnIndicator view={view} />
        </div>

        {/* code input */}
        <div className="mt-8">
          <CodeInput value={draft} onChange={setDraft} onSubmit={submit} />
          {error && <div className="mt-3 text-danger text-sm">{error}</div>}
          <button
            className="btn-primary mt-5"
            disabled={draft.length !== 4 || (!needsToSetCode && !isYourTurn)}
            onClick={submit}
          >
            {needsToSetCode ? "Lock in code" : "Submit guess"}
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <GuessColumn
            title="Your guesses"
            guesses={view.yourGuesses}
            empty="Your guesses will show here"
          />
          <GuessColumn
            title="Opponent guesses"
            guesses={view.opponentGuesses.map((g) => ({
              code: g.code ?? "• • • •",
              result: g.result,
              timestamp: g.timestamp,
            }))}
            empty="No guesses yet"
            hideCode
          />
        </div>
      </div>

      <aside className="space-y-6">
        {tauntLine && (
          <div className="panel-elevated p-4 animate-slide-up">
            <div className="text-[10px] uppercase tracking-[0.22em] text-honey">
              The Vault says
            </div>
            <div className="mt-2 text-fg-primary leading-snug">{tauntLine}</div>
          </div>
        )}

        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
            You — {walletAddress ? shortAddress(walletAddress, 5) : "anon"}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-fg-secondary">Your code:</span>
            <span className="font-mono tabular-nums text-fg-primary">
              {view.yourCode ?? "——"}
            </span>
          </div>
          <div className="divider my-4" />
          <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
            Opponent
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-mono text-fg-primary">
              {view.opponent ? shortAddress(view.opponent, 5) : "waiting"}
            </span>
            <span className="chip py-0.5 px-2 text-[10px]">
              {view.opponentCodeSet ? "ready" : "setting"}
            </span>
          </div>
        </div>

        <ChatBox onSend={onSendChat} />
      </aside>
    </div>
  );
}

function TurnIndicator({ view }: { view: import("../lib/socket").SafeGameView }) {
  const yours = view.currentTurn === view.you;
  return (
    <div
      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
        yours
          ? "text-accent border-accent/30 bg-transparent"
          : "bg-ink-elevated text-fg-secondary border-ink-border"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full mr-2 ${
          yours ? "bg-accent animate-pulse" : "bg-fg-muted"
        }`}
      />
      {yours ? "Your turn" : "Opponent turn"}
    </div>
  );
}

function CodeInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cells = [0, 1, 2, 3];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="relative cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="\d*"
        maxLength={4}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <div className="grid grid-cols-4 gap-3 max-w-md">
        {cells.map((i) => {
          const ch = value[i] ?? "";
          const active = i === value.length;
          return (
            <div
              key={i}
              className={`aspect-square rounded-2xl border font-mono text-5xl grid place-items-center transition-colors ${
                ch
                  ? "bg-ink-elevated border-accent/40 text-fg-primary"
                  : active
                    ? "bg-ink-elevated border-accent/20 text-fg-muted"
                    : "bg-ink-raised border-ink-border text-fg-dim"
              }`}
            >
              {ch || (active ? "|" : "·")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuessColumn({
  title,
  guesses,
  empty,
  hideCode,
}: {
  title: string;
  guesses: Array<{ code: string; result: { pots: number; pans: number }; timestamp: number }>;
  empty: string;
  hideCode?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">{title}</div>
      <div className="mt-3 space-y-2">
        {guesses.length === 0 ? (
          <div className="text-fg-muted text-sm">{empty}</div>
        ) : (
          guesses.map((g, i) => (
            <div
              key={i}
              className="panel px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-1">
                {g.code.split("").map((c, j) => (
                  <span
                    key={j}
                    className={`w-8 h-8 grid place-items-center rounded-md font-mono text-base ${
                      hideCode
                        ? "bg-ink-elevated text-fg-muted"
                        : "bg-ink-elevated text-fg-primary"
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="chip-accent">🍲 {g.result.pots} POT</span>
                <span className="chip-honey">🍳 {g.result.pans} PAN</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatBox({ onSend }: { onSend: (m: string) => void }) {
  const chat = useGameStore((s) => s.chat);
  const [draft, setDraft] = useState("");
  return (
    <div className="panel p-4 flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">Chat</div>
      <div className="mt-3 max-h-40 overflow-y-auto space-y-1.5">
        {chat.length === 0 ? (
          <div className="text-fg-muted text-sm">No messages yet.</div>
        ) : (
          chat.map((m, i) => (
            <div key={i} className="text-sm leading-tight">
              <span className="font-mono text-fg-muted mr-2">{m.sender}</span>
              <span className="text-fg-primary">{m.message}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onSend(draft.slice(0, 200));
          setDraft("");
        }}
      >
        <input
          className="input flex-1 py-1.5 text-sm"
          placeholder="Type…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    </div>
  );
}

function FinishedPanel({
  finished,
  me,
  onPlayAgain,
}: {
  finished: NonNullable<ReturnType<typeof useGameStore.getState>["finished"]>;
  me?: string;
  onPlayAgain: () => void;
}) {
  const won = finished.winner === me;
  const draw = finished.isDraw;

  return (
    <div className="max-w-xl mx-auto panel-elevated p-10 text-center animate-fade-in">
      <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
        {draw ? "Draw" : won ? "You won" : "Game over"}
      </div>
      <div
        className={`mt-3 text-5xl md:text-6xl font-display font-bold tracking-tightest ${won ? "text-accent" : "text-fg-primary"}`}
      >
        {draw ? "It's a draw." : won ? "Crackd." : "Unbreakable."}
      </div>
      {finished.payoutTxHash && (
        <div className="mt-4 text-xs text-fg-muted">
          Settlement{" "}
          <a
            className="text-accent hover:underline"
            href={`https://stellar.expert/explorer/testnet/tx/${finished.payoutTxHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {finished.payoutTxHash.slice(0, 8)}…
          </a>
        </div>
      )}

      <div className="divider my-6" />

      <div className="grid grid-cols-2 gap-4 text-left">
        <GuessMini
          label="You guessed"
          guesses={finished.final.playerOneGuesses}
          code={finished.final.playerOneCode}
        />
        <GuessMini
          label="Opponent guessed"
          guesses={finished.final.playerTwoGuesses}
          code={finished.final.playerTwoCode}
        />
      </div>

      <div className="mt-8 flex gap-3 justify-center">
        <button className="btn-primary" onClick={onPlayAgain}>
          Play again
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const text = `I just ${won ? "crackd" : "played"} on Crackd — ${finished.final.playerOneCode} vs ${finished.final.playerTwoCode}. Who can crack me? 🔐`;
            navigator.clipboard.writeText(text);
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

function GuessMini({
  label,
  guesses,
  code,
}: {
  label: string;
  guesses: Array<{ code: string; result: { pots: number; pans: number } }>;
  code: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">{label}</div>
      <div className="mt-2 font-mono text-xl tracking-[0.2em] text-fg-primary">
        {code}
      </div>
      <div className="mt-1 text-xs text-fg-muted">{guesses.length} guess(es)</div>
    </div>
  );
}

// --- helpers ---

function modeLabel(m: Mode): string {
  switch (m) {
    case "vs_ai_free":
      return "vs AI · free";
    case "vs_ai_staked":
      return "vs AI · staked";
    case "pvp_casual":
      return "Multiplayer · casual";
    case "pvp_staked":
      return "Multiplayer · staked";
  }
}

function generateAnon(): string {
  // Casual modes let users play without a wallet. We need a stable
  // "address-like" identifier per tab so the backend can assign them to
  // a slot. A random G-looking string works (not a real Stellar key).
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "G";
  for (let i = 0; i < 55; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function lookupGameIdFromInvite(invite: string): Promise<string | null> {
  // Backend doesn't yet expose a dedicated lookup; treat the invite code
  // as a suffix and let the backend resolve on emit. For MVP we rely on
  // the user pasting the full uuid if the short code fails.
  return invite.length > 20 ? invite : null;
}
