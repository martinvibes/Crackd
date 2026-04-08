# Crackd 🔐
### *Set it. Guard it. Crack it.*

**Crackd** is a competitive, skill-based code-breaking game on Stellar where players stake XLM, outsmart their opponent, and win their bag instantly — secured by Soroban smart contracts. No middleman. No trust required. The contract is the referee.

> 🔗 **Built for:** [Stellar WA Build Weekend Residency 2026](https://bit.ly/stellarwabresidency) — GameFi Track

---

## The Problem

West African gamers have no access to skill-based, competitive blockchain games on Stellar where they can stake real value and earn transparently.

Existing GameFi is dominated by:
- Luck-based mechanics with no real skill ceiling
- Unsustainable token economies that collapse in weeks
- Products built for Asian or Western markets — none of it speaks to West African players

**Crackd fixes this.** Two players. One code. Real XLM on the line. The fastest mind wins.

---

## What is Crackd?

Crackd is a 1v1 code-breaking game inspired by the classic Mastermind/Bulls & Cows mechanic — rebuilt from the ground up as a fully on-chain GameFi experience on Stellar.

Each player sets a secret 4-digit code. Take turns guessing your opponent's code using feedback clues. **First to crack the code wins the pot.**

### Feedback System
| Symbol | Meaning |
|--------|---------|
| 🍲 **POT** | Correct digit, correct position |
| 🍳 **PAN** | Correct digit, wrong position |

Example:
```
Secret Code:  5 8 3 1
Your Guess:   5 2 3 7
Feedback:     2 POT, 0 PAN  (5 and 3 are correct positions)
```

---

## Game Modes

### 🤖 vs The Vault (AI — Free)
Practice against our Claude-powered AI opponent. No wallet needed. The Vault trash talks you in Pidgin English after every bad guess. *"Omo you think say you fit crack my code? Try again."*

### 🤖 vs The Vault (Staked) ⭐
Challenge the AI with real XLM on the line. Win from the community prize pool. The smarter you play, the bigger your reward.

**Dynamic reward multiplier:**
| Guesses Used | Reward |
|---|---|
| 1 – 3 guesses | **2x** your stake |
| 4 – 5 guesses | **1.5x** your stake |
| 6 – 7 guesses | **1x** your stake |
| 8+ guesses | **0.75x** your stake |

**24hr Win Cap:** No single player can drain more than 25% of the prize pool per day. Resets every 24 hours. Keeps the pool healthy and the game fair.

### 👥 Multiplayer — Casual
Create a room, share the invite code, play a friend for free. Stats tracked to your wallet profile.

### 👥 Multiplayer — Staked ⭐
Both players stake equal XLM. Soroban contract locks both stakes. Winner takes all minus 2.5% protocol fee. **Settlement is automatic and instant** — no button to click, no waiting, no trust required.

In case of a draw — full refund to both players.

---

## Why Stellar?

Most GameFi games use the blockchain as a payment layer and nothing else. **In Crackd, Stellar IS the game.**

- **Instant settlement** — Soroban contracts release winnings the moment the game ends. No 10-minute wait. No gas wars.
- **Trustless escrow** — Two strangers in Lagos and Accra can stake real money against each other without trusting each other. The contract holds the funds and determines the winner. It never lies.
- **Near-zero fees** — Micro-stakes are viable. Players can stake 2 XLM or 200 XLM. Nobody is priced out.
- **On-chain leaderboard** — Every win, every streak, every XLM earned is permanently recorded on Stellar. Your reputation is yours.

---

## Architecture

```
┌─────────────────────────────────────┐
│           Frontend (React)          │
│     Freighter Wallet Integration    │
└────────────────┬────────────────────┘
                 │ REST + WebSocket
┌────────────────▼────────────────────┐
│         Backend (Node.js)           │
│  Socket.io · Game State · Auth      │
│  Winner Verification · Chat         │
└──────┬──────────────────┬───────────┘
       │ Stellar SDK       │ Claude API
┌──────▼──────┐    ┌───────▼────────┐
│  Soroban    │    │   Claude AI    │
│  Contracts  │    │  Pidgin Trash  │
│             │    │  Talk + Logic  │
│ CrackdVault │    └────────────────┘
│ CrackdDuel  │
└──────┬──────┘
       │
┌──────▼──────┐
│   Stellar   │
│  Blockchain │
└─────────────┘
```

### Smart Contracts (Soroban / Rust)

**CrackdVault** — Prize Pool Contract (vs AI)
- Manages community prize pool
- Dynamic reward multiplier based on performance
- 25% daily win cap per player with 24hr reset
- On-chain leaderboard and player stats
- Public pool balance readable by frontend in real time

**CrackdDuel** — PvP Escrow Contract (Multiplayer)
- Locks both players' stakes at game start
- Automatic winner payout on game end
- 2.5% protocol fee to treasury
- Full refund on draw or timeout
- Game expires after 1 hour if opponent never joins

### Backend (Node.js + Express)
- Real-time game state sync via Socket.io WebSockets
- In-game chat piggybacked on game state socket (no extra infrastructure)
- Claude API integration for AI opponent and Pidgin trash talk
- Server-side winner verification before any contract call (prevents cheating)
- Redis for active game session storage

### Frontend (React)
- Freighter wallet connection
- Live prize pool balance display on homepage
- Player profiles tied to wallet address
- On-chain leaderboard
- One-tap reaction taunts during multiplayer
- Auto-collapsing chat during active turns

---

## Features

| Feature | Status |
|---------|--------|
| Core game mechanics (code-breaking) | ✅ Complete |
| VS AI (free) | ✅ Complete |
| Multiplayer casual | ✅ Complete |
| Staking on Base (prototype) | ✅ Complete |
| Freighter wallet integration | 🔨 In Progress |
| Soroban CrackdVault contract | 🔨 In Progress |
| Soroban CrackdDuel contract | 🔨 In Progress |
| Prize pool mechanics + 24hr cap | 🔨 In Progress |
| Dynamic reward multiplier | 🔨 In Progress |
| Pidgin AI trash talk | 🔨 In Progress |
| On-chain leaderboard | 🔨 In Progress |
| Player profiles | 🔨 In Progress |
| Live pool balance display | 🔨 In Progress |
| In-game chat (WebSocket) | 🔨 In Progress |
| One-tap taunts | 📋 Planned |
| NFT achievement badges | 📋 Planned |
| Daily challenge mode | 📋 Planned |
| Tournament brackets | 📋 Planned |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Rust · Soroban SDK · Stellar |
| Backend | Node.js · Express · Socket.io · Redis |
| Frontend | React · TypeScript · TailwindCSS |
| Wallet | Freighter (Stellar) |
| AI | Claude API (Anthropic) |
| Payments | XLM · Stellar Testnet → Mainnet |
| Deployment | Vercel (frontend) · Railway (backend) |

---

## Getting Started

### Prerequisites
- Node.js v18+
- Rust + Soroban CLI
- Freighter browser wallet
- Stellar testnet account with test XLM

### Installation

```bash
# Clone the repo
git clone https://github.com/martinvibes/Crackd.git
cd Crackd

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Set up environment variables
cp .env.example .env
# Add your Claude API key and Stellar contract addresses
```

### Environment Variables

```env
# Frontend
VITE_SOROBAN_NETWORK=testnet
VITE_CRACKDVAULT_CONTRACT_ID=your_contract_id
VITE_CRACKDDUEL_CONTRACT_ID=your_contract_id
VITE_BACKEND_URL=http://localhost:3001

# Backend
CLAUDE_API_KEY=your_claude_api_key
STELLAR_NETWORK=testnet
ADMIN_SECRET_KEY=your_stellar_secret_key
REDIS_URL=redis://localhost:6379
PORT=3001
```

### Run Locally

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` and connect your Freighter wallet.

---

## Smart Contract Deployment

```bash
# Install Soroban CLI
cargo install --locked soroban-cli

# Build contracts
cd contracts
cargo build --target wasm32-unknown-unknown --release

# Deploy CrackdVault to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crackd_vault.wasm \
  --network testnet \
  --source your_account

# Deploy CrackdDuel to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crackd_duel.wasm \
  --network testnet \
  --source your_account
```

---

## Revenue Model

Every staked multiplayer game charges a **2.5% protocol fee** collected in the CrackdDuel contract treasury. Withdrawable by admin wallet. 

At 100 staked games per day averaging 20 XLM per game:
- Daily volume: 2,000 XLM
- Daily protocol revenue: 50 XLM
- Monthly: ~1,500 XLM

As player volume grows, the prize pool self-sustains through player losses to The Vault — creating a flywheel where more players = bigger pool = more incentive to play.

---

## Roadmap

**Sprint (April 14–18)**
- Migrate staking from Base to Soroban
- Deploy both contracts to Stellar testnet
- Integrate Freighter wallet
- Build prize pool + dynamic rewards
- Launch Pidgin trash talk AI
- Ship leaderboard + player profiles

**Post-Residency (30 days)**
- Mainnet deployment
- Seed prize pool with real XLM
- 50+ real staked games played
- NFT achievement badges
- Daily challenge mode

**Long term**
- Tournament brackets
- Mobile-optimized experience
- Multi-language support (Pidgin, Twi, Yoruba UI)
- Open SDK for other games to use CrackdDuel escrow contract

---

## About the Builder

**Martin Machiebe** — Web3 & Frontend Developer, Nigeria

Web3 builder with experience across Solidity, Cairo, and Rust smart contract development. Previously shipped PrediFi (decentralized prediction protocol on Soroban, 106 forks) and AI ONE (AI-powered DeFi platform across multiple chains) under Web3Novalabs.

- GitHub: [@martinvibes](https://github.com/martinvibes)
- Twitter: [@martin_tech21](https://twitter.com/martin_tech21)
- LinkedIn: [martin-machiebe](https://www.linkedin.com/in/martin-machiebe-273028294/)

---

## License

MIT — build on top of this, fork it, make it yours.

---

<div align="center">

**Crackd** — *The code is set. The XLM is locked. Can you crack it?*

[🎮 Play Now](https://pan-and-pot-base.vercel.app/) · [🐦 Follow](https://twitter.com/martin_tech21) · [⭐ Star this repo](https://github.com/martinvibes/Crackd)

</div>
