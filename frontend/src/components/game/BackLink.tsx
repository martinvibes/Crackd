/**
 * Shared back-link pill used at the top of every in-flight Game panel so
 * users never reach for the browser back button.
 */
export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
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
