/**
 * Minimal in-game chat. Rate-limiting + moderation live in the backend;
 * this is just UI.
 */
import { useState } from "react";
import { useGameStore } from "../../store/gameStore";

export function ChatBox({ onSend }: { onSend: (m: string) => void }) {
  const chat = useGameStore((s) => s.chat);
  const [draft, setDraft] = useState("");

  return (
    <div className="panel p-4 flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
        Chat
      </div>
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
