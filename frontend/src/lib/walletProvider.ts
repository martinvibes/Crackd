/**
 * One contract, two implementations:
 *  - kitProvider   → @creit.tech/stellar-wallets-kit (Freighter, Albedo, …)
 *  - privyProvider → @privy-io/react-auth Stellar embedded wallet
 *                    (via the extended-chains useSignRawHash API; the
 *                    final Soroban envelope is assembled in lib/privy.ts)
 *
 * walletStore.kind picks which one is active. Components call
 * getActiveProvider() in lib/wallet.ts and use the returned WalletProvider.
 * No call site imports either implementation directly — that's how Game.tsx
 * stays provider-agnostic.
 */
export type WalletKind = "none" | "kit" | "privy";

export interface WalletProvider {
  readonly kind: Exclude<WalletKind, "none">;
  getAddress(): Promise<string>;
  /** Sign a Soroban tx envelope. Returns the signed XDR + signer address. */
  signTransaction(xdr: string): Promise<{ signedXdr: string; signerAddress: string }>;
  disconnect(): Promise<void>;
}
