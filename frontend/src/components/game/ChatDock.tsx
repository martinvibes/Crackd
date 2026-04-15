/**
 * ChatDock — floating chat panel that lives above the bottom tab bar
 * without fighting the board layout.
 *
 * Collapsed: a small magenta pill with a bubble icon + unread count.
 * Expanded: a 320px chat panel sliding up from the toggle.
 *
 * Unread count resets when the panel is opened.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/gameStore";

export function ChatDock({ onSend }: { onSend: (m: string) => void }) {
  const chat = useGameStore((s) => s.chat);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const seenRef = useRef(chat.length);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Track unread when closed.
  useEffect(() => {
    if (open) {
      seenRef.current = chat.length;
      setUnread(0);
    } else {
      setUnread(Math.max(0, chat.length - seenRef.current));
    }
  }, [chat.length, open]);

  // Auto-scroll to latest when panel is open.
  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [open, chat.length]);

  return (
    <div className="fixed right-5 bottom-24 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-[320px] max-w-[86vw] mb-3 panel-elevated overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-border">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-fg-muted">
                  In-game chat
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-fg-muted hover:text-fg-primary text-lg leading-none"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>

            <div
              ref={scrollerRef}
              className="px-4 py-3 max-h-72 overflow-y-auto space-y-1.5 flex-1"
            >
              {chat.length === 0 ? (
                <div className="text-fg-muted text-sm">No messages yet.</div>
              ) : (
                chat.map((m, i) => (
                  <div key={i} className="text-sm leading-tight">
                    <span className="font-mono text-fg-muted mr-2">
                      {m.sender}
                    </span>
                    <span className="text-fg-primary">{m.message}</span>
                  </div>
                ))
              )}
            </div>

            <form
              className="px-3 pb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                onSend(draft.slice(0, 200));
                setDraft("");
              }}
            >
              <input
                autoFocus
                className="input flex-1 py-2 text-sm"
                placeholder="Say something…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-12 w-12 rounded-full border transition-transform hover:-translate-y-0.5"
        style={{
          background: open ? "rgba(255,0,168,0.15)" : "rgba(4,0,8,0.85)",
          borderColor: "rgba(255,0,168,0.35)",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.6)",
        }}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        <IconBubble />
        {unread > 0 && !open && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-[20px] rounded-full text-[10px] font-semibold grid place-items-center px-1"
            style={{ background: "#FF00A8", color: "#040008" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}

function IconBubble() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF00A8"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
