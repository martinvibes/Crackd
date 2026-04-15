/**
 * Timeline helpers — pure functions that turn a game view into an ordered
 * list of guess bubbles for the Board to render.
 *
 * Both sides' guess arrays are chronological; we interleave by timestamp
 * so the newest guess lands at the bottom of the thread (chat-feel).
 */
import type { SafeGameView } from "../../../lib/socket";

export type Side = "you" | "them";

export interface TimelineItem {
  side: Side;
  code: string;
  result: { pots: number; pans: number };
  timestamp: number;
  redacted?: boolean;
}

export function buildTimeline(view: SafeGameView): TimelineItem[] {
  const mine: TimelineItem[] = view.yourGuesses.map((g) => ({
    side: "you",
    code: g.code,
    result: g.result,
    timestamp: g.timestamp,
  }));
  const theirs: TimelineItem[] = view.opponentGuesses.map((g) => ({
    side: "them",
    code: g.code ?? "••••",
    result: g.result,
    timestamp: g.timestamp,
    redacted: !g.code,
  }));
  return [...mine, ...theirs].sort((a, b) => a.timestamp - b.timestamp);
}
