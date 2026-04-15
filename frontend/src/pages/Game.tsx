/**
 * Game page — pure orchestrator.
 *
 * State machine:
 *   mode_pick → setup → lobby → setting_codes → active → finished
 *
 * Backend owns authoritative game state; we render the `view` blob we
 * receive over the socket. Player-initiated socket events are emitted
 * via `useGameSocket`, and wallet-signed contract calls flow through
 * `lib/stellar` → `lib/wallet` → backend `submitSignedTransaction`.
 *
 * Every stage's UI lives in a small file under `components/game/`. This
 * file is deliberately thin — it only decides *which* panel to show
 * and handles the create/join transaction plumbing.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWalletStore } from "../store/walletStore";
import { useGameStore } from "../store/gameStore";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
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
  toStroops,
} from "../lib/stellar";
import { signTransaction } from "../lib/wallet";

import { ErrorBar } from "../components/game/ErrorBar";
import { ModePicker, type Mode } from "../components/game/ModePicker";
import { SetupPanel } from "../components/game/SetupPanel";
import { LobbyPanel } from "../components/game/LobbyPanel";
import { Board } from "../components/game/board/Board";
import { FinishedPanel } from "../components/game/FinishedPanel";
import { ChatDock } from "../components/game/ChatDock";

type Stage =
  | "mode_pick"
  | "setup"
  | "lobby"
  | "setting_codes"
  | "active"
  | "finished";

export default function Game() {
  useGameSocket(); // attach socket listeners to the store

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

  // Clear store on unmount.
  useEffect(() => () => reset(), [reset]);

  // Keep mode state in sync with URL so browser back works naturally.
  useEffect(() => {
    setMode(modeParam);
  }, [modeParam]);

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

  // -------------- actions --------------

  async function handleCreate(asset?: string, stakeXlm?: number) {
    if (!mode) return;
    setBusy(true);
    setErr(null);
    try {
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
      const full = invite.includes("-") ? invite : await lookupGameIdFromInvite(invite);
      if (!full) throw new Error("Invite not found");

      const wallet = address ?? generateAnon();
      let signedXdr: string | undefined;

      if (mode === "pvp_staked") {
        if (!address) throw new Error("Connect a wallet to stake");
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

  // -------------- render --------------

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
        <>
          <Board
            walletAddress={(address ?? view.youAre) as string}
            view={view}
            tauntLine={tauntLine}
            onSetCode={(code) =>
              emitSetCode({
                gameId,
                walletAddress: (address ?? view.youAre) as string,
                code,
              })
            }
            onGuess={(guess) =>
              emitMakeGuess({
                gameId,
                walletAddress: (address ?? view.youAre) as string,
                guess,
              })
            }
          />
          <ChatDock
            onSend={(message) =>
              emitChat({
                gameId,
                walletAddress: (address ?? view.youAre) as string,
                message,
              })
            }
          />
        </>
      )}

      {stage === "finished" && finished && (
        <FinishedPanel
          finished={finished}
          me={address ?? (view?.youAre as string | undefined)}
          onPlayAgain={goBackToModePicker}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Tiny helpers kept in this file because they're only used here.
// ------------------------------------------------------------

/**
 * Casual / free modes let users play without a wallet. We still need a
 * stable id per tab so the backend can assign them to a slot; a random
 * G-prefixed string is enough (not a real Stellar key).
 */
function generateAnon(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "G";
  for (let i = 0; i < 55; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Invite-code lookup stub. For MVP we only resolve full game ids; short
 * codes are copy-and-paste friendly but the backend doesn't yet expose
 * a short-code → game-id endpoint.
 */
async function lookupGameIdFromInvite(invite: string): Promise<string | null> {
  return invite.length > 20 ? invite : null;
}
