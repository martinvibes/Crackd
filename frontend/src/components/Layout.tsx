/**
 * Top-level app chrome: sticky navbar + main outlet.
 *
 * The navbar uses backdrop-blur so page content subtly shows through
 * as you scroll. Logo is a custom wordmark, not an image — keeps the
 * bundle tiny and lets us animate it later.
 */
import { NavLink, Outlet } from "react-router-dom";
import WalletButton from "./WalletButton";

function CrackdLogo() {
  return (
    <NavLink
      to="/"
      className="group inline-flex items-center gap-2 select-none"
      aria-label="Crackd home"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-accent transition-transform group-hover:rotate-[-8deg]"
        aria-hidden
      >
        <rect x="3.5" y="8.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 8.5V6a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="11" cy="14" r="1.5" fill="currentColor"/>
      </svg>
      <span className="font-display font-bold text-[17px] tracking-tightest text-fg-primary">
        CRACK<span className="text-accent">D</span>
      </span>
    </NavLink>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `relative px-3 py-1.5 text-sm font-medium transition-colors rounded-lg ${
          isActive ? "text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <span
              className="absolute left-3 right-3 -bottom-[6px] h-[2px] bg-accent rounded-full"
              aria-hidden
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-ink/70 border-b border-ink-border">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <CrackdLogo />
            <nav className="hidden md:flex items-center gap-1">
              <NavItem to="/" label="Play" />
              <NavItem to="/leaderboard" label="Leaderboard" />
            </nav>
          </div>
          <WalletButton />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-border mt-16">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-fg-muted">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-fg-secondary">CRACKD</span>
            <span>Built on Stellar · Testnet</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://stellar.expert/explorer/testnet/contract/CAOBL4NDX2MELQHF7HOVDPG7Z5JAGIJCMYSBZRXJ42OMRKIZNLEYJU3E"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg-primary transition-colors"
            >
              Vault contract ↗
            </a>
            <a
              href="https://stellar.expert/explorer/testnet/contract/CBDHNQFBASF3JZJBVA67SBDRWNCL7HPA67S5JIZ44MKLYO25H5MFFZNR"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg-primary transition-colors"
            >
              Duel contract ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
