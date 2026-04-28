/**
 * Multi-wallet kit wrapper (v2.1 API — all static methods).
 *
 * Supports Freighter, Albedo, xBull, Lobstr, Hana, Rabet out of the box.
 * Users pick in the modal; we default nothing.
 */
import {
  Networks,
  StellarWalletsKit,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";

const network: Networks =
  (import.meta.env.VITE_STELLAR_NETWORK as string) === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

let initialised = false;
function ensureInit() {
  if (initialised) return;
  StellarWalletsKit.init({
    network,
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
      new xBullModule(),
      new LobstrModule(),
      new HanaModule(),
      new RabetModule(),
    ],
  });
  initialised = true;
}

export const kit = {
  async getAddress() {
    ensureInit();
    return await StellarWalletsKit.getAddress();
  },
  setWallet(id: string) {
    ensureInit();
    StellarWalletsKit.setWallet(id);
  },
  async disconnect() {
    ensureInit();
    await StellarWalletsKit.disconnect();
  },
  async signTransaction(xdr: string, opts: { networkPassphrase: string }) {
    ensureInit();
    return await StellarWalletsKit.signTransaction(xdr, opts);
  },
};

export async function connectWallet(): Promise<string> {
  ensureInit();
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

export async function signTransaction(
  xdr: string,
): Promise<{ signedXdr: string; signerAddress: string }> {
  ensureInit();
  const { signedTxXdr, signerAddress } = await StellarWalletsKit.signTransaction(
    xdr,
    { networkPassphrase },
  );
  return { signedXdr: signedTxXdr, signerAddress: signerAddress ?? "" };
}

export const networkPassphrase =
  network === Networks.PUBLIC
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export const isTestnet = network === Networks.TESTNET;

// ============================================================
// WalletProvider abstraction
// ============================================================
//
// The rest of the app should not know which wallet backend is in use.
// `kitProvider` wraps the existing Stellar Wallets Kit path; `privyProvider`
// (in ./privy) wraps the Privy embedded-Stellar-wallet path. `getActiveProvider`
// resolves the current one off `walletStore.kind`.

import type { WalletProvider } from "./walletProvider";

export const kitProvider: WalletProvider = {
  kind: "kit",
  async getAddress() {
    const { address } = await kit.getAddress();
    if (!address) throw new Error("Kit wallet has no address");
    return address;
  },
  async signTransaction(xdr: string) {
    return await signTransaction(xdr);
  },
  async disconnect() {
    await kit.disconnect();
  },
};

/**
 * Resolve the currently-active provider from walletStore. Imports are
 * lazy to avoid the circular dep — walletStore imports lib/wallet for
 * `connectWallet`, so this module can't statically import the store.
 */
export async function getActiveProvider(): Promise<WalletProvider> {
  const { useWalletStore } = await import("../store/walletStore");
  const kind = useWalletStore.getState().kind;
  if (kind === "privy") {
    const mod = (await import("./privy")) as { privyProvider: WalletProvider };
    return mod.privyProvider;
  }
  return kitProvider;
}
