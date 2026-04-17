/**
 * PlayLayout — game-app chrome: minimal top bar (logo only), floating
 * bottom tab bar for navigation. Feels like a game, not a website.
 *
 * Only used on `/play`. The rest of the app keeps the top-nav Layout.
 */
import { Link, NavLink, Outlet } from "react-router-dom";
import WalletButton from "./WalletButton";
import { BrandMark, Wordmark } from "./Brand";

const MAGENTA = "#FF00A8";

export default function PlayLayout() {
  return (
    <div className="min-h-full flex flex-col">
      {/* top bar — logo + wallet only, no nav links */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-ink/70 border-b border-ink-border">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-fg-primary"
            aria-label="Crackd home"
          >
            <BrandMark size={20} />
            <Wordmark size={15} />
          </Link>
          <WalletButton />
        </div>
      </header>

      {/* content */}
      <main className="flex-1 pb-28">
        <Outlet />
      </main>

      {/* floating bottom tab bar */}
      <nav
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40"
        aria-label="Primary"
      >
        <div
          className="flex items-center gap-1 p-1.5 rounded-full backdrop-blur-xl"
          style={{
            background: "rgba(11,6,18,0.85)",
            border: "1px solid rgba(255, 0, 168, 0.22)",
            boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >
          <TabLink to="/" label="Home" icon={<IconHome />} />
          <TabLink to="/play" label="Play" icon={<IconPlay />} end />
          <TabLink to="/leaderboard" label="Winners" icon={<IconTrophy />} />
          <TabLink to="/profile" label="Profile" icon={<IconProfile />} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${
          isActive
            ? "text-ink"
            : "text-fg-secondary hover:text-fg-primary"
        }`
      }
      style={({ isActive }) => (isActive ? { background: MAGENTA } : {})}
    >
      <span className="w-3.5 h-3.5">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 12 3l9 9"/><path d="M5 10v11h14V10"/>
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4z"/>
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 0 1-14 0V4z"/>
      <path d="M5 6H3a2 2 0 0 0 2 4M19 6h2a2 2 0 0 1-2 4"/>
    </svg>
  );
}
function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M20 21c0-3.87-3.58-7-8-7s-8 3.13-8 7"/>
    </svg>
  );
}
