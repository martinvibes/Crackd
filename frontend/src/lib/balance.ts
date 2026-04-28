/**
 * Live wallet balance — XLM + supported assets — read from Horizon.
 *
 * Horizon is the right read source here (Soroban RPC's getAccount only
 * returns sequence/signers, not asset balances). For testnet the
 * endpoint is unauthenticated and rate limits are generous.
 *
 * React-Query owns the cache + polling cadence. We refetch every 30s
 * while the user is on a wallet-aware page and on focus, so the pill
 * always reflects reality after a stake/payout.
 */
import { useQuery } from "@tanstack/react-query";

const HORIZON_URL =
  (import.meta.env.VITE_STELLAR_NETWORK as string) === "mainnet"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";

interface HorizonBalance {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
}

interface HorizonAccount {
  balances: HorizonBalance[];
}

export interface WalletBalance {
  asset: string;
  amount: number;
  isNative: boolean;
}

async function fetchBalances(address: string): Promise<WalletBalance[]> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) {
    // Account doesn't exist on the network yet (unfunded). Return zeros.
    return [{ asset: "XLM", amount: 0, isNative: true }];
  }
  if (!res.ok) {
    throw new Error(`Horizon ${res.status}`);
  }
  const data = (await res.json()) as HorizonAccount;
  return data.balances.map((b) => ({
    asset:
      b.asset_type === "native"
        ? "XLM"
        : b.asset_code ?? b.asset_type,
    amount: Number(b.balance),
    isNative: b.asset_type === "native",
  }));
}

export function useBalances(address: string | null) {
  return useQuery<WalletBalance[]>({
    queryKey: ["balances", address],
    queryFn: () => fetchBalances(address!),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
