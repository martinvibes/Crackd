/**
 * Mode picker — the first screen at /play. Four modes, each with a dial-
 * based icon that echoes the home page's signature safe dial.
 */
export type Mode =
  | "vs_ai_free"
  | "vs_ai_staked"
  | "pvp_casual"
  | "pvp_staked";

interface ModeCard {
  m: Mode;
  t: string;
  d: string;
  icon: React.ReactNode;
  staked?: boolean;
  /** If true, disable the card and show a "coming soon" overlay. */
  comingSoon?: boolean;
}

const MODE_CARDS: ModeCard[] = [
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
    comingSoon: true,
  },
];

export function ModePicker({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="animate-fade-in">
      <div className="text-[11px] uppercase tracking-[0.22em] text-fg-muted">
        Start a game
      </div>
      <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-[-0.03em]">
        Pick how you want to play.
      </h1>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
        {MODE_CARDS.map(({ m, t, d, icon, staked, comingSoon }) => (
          <button
            key={m}
            onClick={() => !comingSoon && onPick(m)}
            disabled={comingSoon}
            className={`group relative text-left p-5 md:p-6 rounded-2xl border bg-ink-raised transition-all ${
              comingSoon
                ? "border-ink-border opacity-60 cursor-not-allowed"
                : staked
                  ? "border-accent/20 hover:border-accent/45 hover:-translate-y-0.5 hover:bg-ink-elevated"
                  : "border-ink-border hover:border-ink-border-strong hover:-translate-y-0.5 hover:bg-ink-elevated"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${
                  comingSoon
                    ? "bg-ink-elevated text-fg-muted"
                    : staked
                      ? "bg-accent/10 text-accent group-hover:bg-accent/15"
                      : "bg-ink-elevated text-fg-secondary group-hover:text-fg-primary"
                }`}
              >
                {icon}
              </span>
              {comingSoon ? (
                <span className="text-[9px] uppercase tracking-[0.24em] text-fg-muted pt-1">
                  Coming soon
                </span>
              ) : staked ? (
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
            {!comingSoon && (
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-fg-secondary group-hover:text-fg-primary transition-colors">
                Start
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            )}
            {comingSoon && (
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-fg-muted">
                Unlocking post-launch
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Mode icons — geometric glyphs that riff on the home page's dial.
// ------------------------------------------------------------

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

// Helper the Game page uses to label modes in titles.
export function modeLabel(m: Mode): string {
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
