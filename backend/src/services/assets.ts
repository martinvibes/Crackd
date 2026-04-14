/**
 * Asset registry — maps short symbols (XLM, USDC) to their on-chain SAC
 * addresses. One source of truth for the backend; routes and the stellar
 * service both read from here.
 *
 * Adding a new asset = add an env var + add a row below + redeploy the
 * backend. Contract code doesn't change (already multi-asset).
 */
import type { AppConfig } from "../config.js";

export type AssetSymbol = string;

export interface Asset {
  symbol: AssetSymbol;
  sac: string;          // Stellar Asset Contract address (C…)
  decimals: number;
  displayName: string;
  isNative: boolean;
}

export interface AssetRegistry {
  list(): Asset[];
  get(symbol: AssetSymbol): Asset;
  getBySac(sac: string): Asset | undefined;
  isSupported(symbol: AssetSymbol): boolean;
}

export function buildAssetRegistry(cfg: AppConfig): AssetRegistry {
  const supported = cfg.SUPPORTED_ASSETS.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const all: Record<string, Asset> = {
    XLM: {
      symbol: "XLM",
      sac: cfg.NATIVE_XLM_SAC,
      decimals: 7,
      displayName: "Stellar Lumens",
      isNative: true,
    },
    USDC: {
      symbol: "USDC",
      sac: cfg.USDC_SAC,
      decimals: 7,
      displayName: "USD Coin",
      isNative: false,
    },
  };

  const enabled: Asset[] = [];
  for (const sym of supported) {
    const a = all[sym];
    if (!a) throw new Error(`SUPPORTED_ASSETS references unknown symbol: ${sym}`);
    enabled.push(a);
  }
  const bySymbol = new Map(enabled.map((a) => [a.symbol, a]));
  const bySac = new Map(enabled.map((a) => [a.sac, a]));

  return {
    list: () => enabled.slice(),
    get(symbol) {
      const a = bySymbol.get(symbol.toUpperCase());
      if (!a) throw new Error(`Unsupported asset: ${symbol}`);
      return a;
    },
    getBySac: (sac) => bySac.get(sac),
    isSupported: (symbol) => bySymbol.has(symbol.toUpperCase()),
  };
}
