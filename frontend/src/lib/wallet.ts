/**
 * Multi-wallet kit wrapper.
 *
 * `@creit.tech/stellar-wallets-kit` auto-detects installed wallets and
 * shows a modal. One call to `openWalletModal()` covers Freighter,
 * Albedo, xBull, Lobstr, Hana, and any newcomers.
 *
 * We default to testnet; a prod build flips via VITE_STELLAR_NETWORK.
 */
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

const network: WalletNetwork =
  (import.meta.env.VITE_STELLAR_NETWORK as string) === "mainnet"
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

export const kit = new StellarWalletsKit({
  network,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

/**
 * Open the picker. Resolves with the selected wallet's public key.
 * Throws if the user dismisses.
 */
export async function connectWallet(): Promise<string> {
  let resolved = false;
  return new Promise((resolve, reject) => {
    kit
      .openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            resolved = true;
            resolve(address);
          } catch (err) {
            reject(err);
          }
        },
        onClosed: () => {
          if (!resolved) reject(new Error("wallet connect cancelled"));
        },
      })
      .catch(reject);
  });
}

/**
 * Signs a transaction XDR via the current wallet. The backend submits.
 */
export async function signTransaction(
  xdr: string,
): Promise<{ signedXdr: string; signerAddress: string }> {
  const { signedTxXdr, signerAddress } = await kit.signTransaction(xdr, {
    networkPassphrase:
      network === WalletNetwork.PUBLIC
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015",
  });
  return { signedXdr: signedTxXdr, signerAddress: signerAddress ?? "" };
}

export const networkPassphrase =
  network === WalletNetwork.PUBLIC
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export const isTestnet = network === WalletNetwork.TESTNET;
