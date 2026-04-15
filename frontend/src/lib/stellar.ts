/**
 * Stellar transaction builders for the frontend.
 *
 * Purpose: construct the XDR for player-initiated contract calls
 * (`stake` on the vault, `create_game` / `join_game` on the duel) so the
 * wallet kit can sign them.
 *
 * Kept deliberately minimal — we build, hand to the wallet to sign,
 * then post the signed XDR to the backend which submits it.
 */
import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

const RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

const NETWORK_PASSPHRASE =
  (import.meta.env.VITE_STELLAR_NETWORK as string) === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

const VAULT_ID = import.meta.env.VITE_CRACKD_VAULT_ID as string;
const DUEL_ID = import.meta.env.VITE_CRACKD_DUEL_ID as string;

const rpcServer = new rpc.Server(RPC_URL);

async function source(publicKey: string) {
  return await rpcServer.getAccount(publicKey);
}

function build(
  sourceAccount: Awaited<ReturnType<typeof source>>,
  op: xdr.Operation,
) {
  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(300)
    .build();
}

/**
 * `stake(player, token, amount)` on the CrackdVault — for staked vs-AI.
 * Returns a simulation-prepared tx ready for wallet signing.
 */
export async function buildVaultStakeTx(
  player: string,
  tokenSac: string,
  amountStroops: bigint,
): Promise<string> {
  const vault = new Contract(VAULT_ID);
  const sourceAccount = await source(player);
  const op = vault.call(
    "stake",
    Address.fromString(player).toScVal(),
    Address.fromString(tokenSac).toScVal(),
    nativeToScVal(amountStroops, { type: "i128" }),
  );
  const tx = build(sourceAccount, op);
  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * `create_game(player, token, stake)` on the CrackdDuel — for staked PvP.
 */
export async function buildDuelCreateTx(
  player: string,
  tokenSac: string,
  stakeStroops: bigint,
): Promise<string> {
  const duel = new Contract(DUEL_ID);
  const sourceAccount = await source(player);
  const op = duel.call(
    "create_game",
    Address.fromString(player).toScVal(),
    Address.fromString(tokenSac).toScVal(),
    nativeToScVal(stakeStroops, { type: "i128" }),
  );
  const tx = build(sourceAccount, op);
  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * `join_game(player, game_id)` on the CrackdDuel.
 * `gameIdHex` is the 32-byte BytesN as a hex string.
 */
export async function buildDuelJoinTx(
  player: string,
  gameIdHex: string,
): Promise<string> {
  const duel = new Contract(DUEL_ID);
  const sourceAccount = await source(player);
  const bytes = Buffer.from(gameIdHex.replace(/^0x/, ""), "hex");
  const op = duel.call(
    "join_game",
    Address.fromString(player).toScVal(),
    nativeToScVal(bytes, { type: "bytes" }),
  );
  const tx = build(sourceAccount, op);
  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared.toXDR();
}

// --- helpers ---
export const STROOPS_PER_UNIT = 10_000_000n;
export function toStroops(amount: number): bigint {
  return BigInt(Math.round(amount * Number(STROOPS_PER_UNIT)));
}
export function fromStroops(stroops: bigint | number | string): number {
  const n = typeof stroops === "bigint" ? Number(stroops) : Number(stroops);
  return n / Number(STROOPS_PER_UNIT);
}
export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
