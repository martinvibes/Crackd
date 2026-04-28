/**
 * Privy embedded Stellar wallet adapter.
 *
 * Privy v3.22 supports Stellar via the **extended chains** API:
 *  - useCreateWallet({ chainType: "stellar" }) creates a Stellar embedded wallet.
 *  - useSignRawHash({ address, chainType: "stellar", hash }) signs a 32-byte
 *    hash and returns the signature as a 0x-prefixed hex string.
 *
 * Privy does NOT assemble the Soroban transaction envelope for us. We build
 * the final signed XDR ourselves with @stellar/stellar-sdk: parse the unsigned
 * envelope, hash it, ask Privy to sign the hash, attach a DecoratedSignature
 * with the right signature hint.
 *
 * Module-level state populated by <PrivyWalletBridge /> (rendered inside
 * <PrivyProvider> in main.tsx). The bridge reads React hook state and writes
 * here so non-React callers (Game.tsx → getActiveProvider() → signTransaction)
 * can reach the active wallet synchronously.
 */
import {
  Keypair,
  Networks,
  TransactionBuilder,
  xdr as Xdr,
} from "@stellar/stellar-sdk";
import type { WalletProvider } from "./walletProvider";

type SignRawHashFn = (input: {
  address: string;
  chainType: "stellar";
  hash: `0x${string}`;
}) => Promise<{ signature: `0x${string}` }>;

interface PrivyState {
  address: string;
  signRawHash: SignRawHashFn;
  logout: () => Promise<void>;
}

let state: PrivyState | null = null;

/** Called by <PrivyWalletBridge /> when the embedded Stellar wallet is
 *  available, and again with null on logout. */
export function setPrivyState(next: PrivyState | null): void {
  state = next;
}

const networkPassphrase =
  (import.meta.env.VITE_STELLAR_NETWORK as string) === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

export const privyProvider: WalletProvider = {
  kind: "privy",

  async getAddress() {
    if (!state) throw new Error("Privy wallet not ready");
    return state.address;
  },

  async signTransaction(unsignedXdr: string) {
    if (!state) throw new Error("Privy wallet not ready");

    // Parse the prepared (unsigned) envelope. TransactionBuilder.fromXDR
    // returns the right Transaction subtype for Soroban.
    const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);

    // Hash to sign: Soroban tx envelope hash, same one tx.sign() would
    // sign internally if we had the private key.
    const hash = tx.hash();
    const hexHash = `0x${hash.toString("hex")}` as `0x${string}`;

    const { signature } = await state.signRawHash({
      address: state.address,
      chainType: "stellar",
      hash: hexHash,
    });

    // signature is "0x" + 128 hex chars (64 bytes — Ed25519). Decode and
    // attach as a DecoratedSignature. The hint is the last 4 bytes of the
    // public key (Ed25519 signature hint convention).
    const sigBytes = Buffer.from(signature.replace(/^0x/, ""), "hex");
    if (sigBytes.length !== 64) {
      throw new Error(
        `Privy signRawHash returned ${sigBytes.length}-byte signature; expected 64`,
      );
    }
    const hint = Keypair.fromPublicKey(state.address).signatureHint();
    tx.signatures.push(
      new Xdr.DecoratedSignature({ hint, signature: sigBytes }),
    );

    return {
      signedXdr: tx.toEnvelope().toXDR("base64"),
      signerAddress: state.address,
    };
  },

  async disconnect() {
    const logout = state?.logout;
    state = null;
    if (logout) await logout();
  },
};
