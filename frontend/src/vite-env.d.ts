/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_STELLAR_NETWORK: "testnet" | "mainnet";
  readonly VITE_STELLAR_RPC_URL: string;
  readonly VITE_CRACKD_VAULT_ID: string;
  readonly VITE_CRACKD_DUEL_ID: string;
  /** Privy app id from https://dashboard.privy.io. Empty disables email login. */
  readonly VITE_PRIVY_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
