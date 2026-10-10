import type {
  Account,
  AmmPool,
  AmmPosition,
  Bech32mAddress,
  Block,
  BlockHeader,
  ConsensusState,
  HashHex,
  HexString,
  MempoolStats,
  NodeStatus,
  Order,
  Peer,
  ProofResponse,
  Receipt,
  TokenInfo,
  Transaction,
  TransactionWithLocation,
  Validator,
} from "./types";

export const DEFAULT_RPC_URL = "http://127.0.0.1:9633";

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export interface RpcClientOptions {
  url: string;
  timeoutMs?: number;
}

// Response shapes for the newer methods. Kept local to this file rather
// than in ./types, because they're only consumed through this client.
// Wire convention (see ./types) applies: hex for anything that could
// exceed 2^53, numbers only for small counts and enums, booleans as
// booleans.

export interface ChainStats {
  height: HexString;
  chain_id: HexString;
  epoch: HexString;
  total_transactions: HexString;
  total_fees_lifetime: HexString;
  total_supply: HexString;
  total_staked: HexString;
  staker_count: HexString;
  current_pot: HexString;
  unique_addresses: HexString;
  unique_tokens: HexString;
  unique_validators: HexString;
  unique_pools: HexString;
  genesis_timestamp_ms: HexString;
}

export interface StakingInfo {
  last_effective_apy_bps: HexString;
  base_bps: HexString;
  activity_bonus_bps: HexString;
  pot_bonus_bps: HexString;
  total_staked: HexString;
  staker_count: HexString;
  current_pot: HexString;
  activity_txs_in_window: HexString;
  avg_tx_per_block: HexString;
  epoch: HexString;
  epoch_start_height: HexString;
  next_epoch_height: HexString;
  blocks_until_next_epoch: HexString;
}

export interface FeeStats {
  total_fees_lifetime: HexString;
  fees_last_epoch: HexString;
  fees_last_24h: HexString;
  avg_fee_per_block: HexString;
  avg_fee_per_transaction: HexString;
  total_transactions: HexString;
}

export interface PotInfo {
  current_pot: HexString;
  pot_high_threshold: HexString;
  pot_fill_bps_of_high: HexString;
  total_to_pot: HexString;
  total_pot_distributed: HexString;
  last_effective_apy_bps: HexString;
  epoch: HexString;
  epoch_start_height: HexString;
  next_epoch_height: HexString;
  blocks_until_payout: HexString;
}

export interface BlockStats {
  from_height: HexString;
  to_height: HexString;
  block_count: HexString;
  total_transactions: HexString;
  total_fees: HexString;
}

export interface EpochInfo {
  epoch: HexString;
  epoch_start_height: HexString;
  next_epoch_height: HexString;
  current_height: HexString;
  blocks_until_next_epoch: HexString;
  rotation_interval: HexString;
}

export interface EpochSchedule {
  rotation_interval: HexString;
  unbonding_period: HexString;
  emergency_rotation_rounds: HexString;
  active_set_min: HexString;
  active_set_max: HexString;
  current_epoch: HexString;
  epoch_start_height: HexString;
}

export interface AddressStats {
  address: Bech32mAddress;
  balance: HexString;
  nonce: HexString;
  staked: HexString;
  pending_rewards: HexString;
  staking_opted_out: boolean;
  token_count: HexString;
  position_count: HexString;
  order_count: HexString;
  is_validator: boolean;
  validator_id: HexString;
}

export interface TxWithLocation {
  tx: Transaction;
  block_hash: HashHex;
  block_height: HexString;
  index: number;
}

export interface BlockRef {
  height: HexString;
  block_hash: HashHex;
}

export interface TxCount {
  total_transactions: HexString;
  epoch_transactions: HexString;
  current_epoch: HexString;
}

export interface MempoolEntry {
  tx: Transaction;
  fee_rate: HexString;
  added_ms: HexString;
  size: HexString;
  tier: "priority" | "standard";
}

export interface TokenBalancePair {
  token_id: HexString;
  balance: HexString;
}

export interface HolderEntry {
  address: Bech32mAddress;
  balance: HexString;
}

export interface BalanceEntry {
  address: Bech32mAddress;
  balance: HexString;
}

export interface AddressListEntry {
  address: Bech32mAddress;
  balance: HexString;
  nonce: HexString;
}

export interface ValidatorListResponse {
  validators: Validator[];
  count: HexString;
  total: HexString;
}

export interface ActiveSetResponse {
  ids: HexString[];
  size: HexString;
  quorum: HexString;
}

export interface HealthResponse {
  ok: boolean;
  height: HexString;
  peers: HexString;
  is_validator: boolean;
}

export interface ValidatorWithBlocks extends Validator {
  recent_blocks: BlockRef[];
}

export interface ChainIdResponse {
  chain_id: HexString;
}

export interface BlockNumberResponse {
  height: HexString;
}

export interface StateRootResponse {
  height: HexString;
  state_root: HashHex;
}

export interface BalanceResponse {
  address: Bech32mAddress;
  token_id: HexString;
  balance: HexString;
}

export interface NonceResponse {
  address: Bech32mAddress;
  nonce: HexString;
}

export interface TokenSupplyResponse {
  token_id: HexString;
  supply: HexString;
}

export interface SendTxResponse {
  tx_hash: HashHex;
  accepted: true;
}

export interface SimulateResponse extends Receipt {
  tx_hash: HashHex;
  height: HexString;
}

export interface RecentTransactionsResponse {
  count: HexString;
  transactions: TxWithLocation[];
}

export interface RecentBlocksResponse {
  count: HexString;
  blocks: BlockHeader[];
}

export interface BlocksRangeResponse {
  count: HexString;
  start: HexString;
  order: "asc" | "desc";
  blocks: BlockHeader[];
}

export interface BlocksByProducerResponse {
  proposer: Bech32mAddress;
  count: HexString;
  blocks: BlockRef[];
}

export interface TokensForAddressResponse {
  address: Bech32mAddress;
  count: HexString;
  tokens: TokenBalancePair[];
}

export interface PositionsForAddressResponse {
  address: Bech32mAddress;
  count: HexString;
  positions: AmmPosition[];
}

export interface OrdersForAddressResponse {
  address: Bech32mAddress;
  count: HexString;
  orders: Order[];
}

export interface TransactionsForAddressResponse {
  address: Bech32mAddress;
  count: HexString;
  transactions: TxWithLocation[];
}

export interface AllTokensResponse {
  count: HexString;
  offset: HexString;
  limit: HexString;
  tokens: TokenInfo[];
}

export interface TokenHoldersResponse {
  token_id: HexString;
  count: HexString;
  total_holders: HexString;
  holders: HolderEntry[];
}

export interface TokenTransfersResponse {
  token_id: HexString;
  count: HexString;
  transfers: TxWithLocation[];
}

export interface TokensByCreatorResponse {
  creator: Bech32mAddress;
  count: HexString;
  tokens: TokenInfo[];
}

export interface AllPoolsResponse {
  count: HexString;
  offset: HexString;
  limit: HexString;
  pools: AmmPool[];
}

export interface PoolsForTokenResponse {
  count: HexString;
  pools: AmmPool[];
}

export interface PositionsForPoolResponse {
  pool_id: HexString;
  count: HexString;
  total: HexString;
  positions: AmmPosition[];
}

export interface AllOrdersResponse {
  count: HexString;
  offset: HexString;
  limit: HexString;
  orders: Order[];
}

export interface OrdersByPairResponse {
  sell_token: HexString;
  buy_token: HexString;
  count: HexString;
  offset: HexString;
  limit: HexString;
  orders: Order[];
}

export interface OrdersExpiringAtResponse {
  height: HexString;
  count: HexString;
  order_ids: HexString[];
}

export interface AddressListResponse {
  count: HexString;
  offset: HexString;
  limit: HexString;
  addresses: AddressListEntry[];
}

export interface MempoolListResponse {
  count: HexString;
  total: HexString;
  order_by: "fee" | "time";
  transactions: MempoolEntry[];
}

export interface PeersResponse {
  count: HexString;
  peers: Peer[];
}

export class RpcClient {
  private nextId = 1;

  constructor(private opts: RpcClientOptions) { }

  private async call<T>(method: string, params: unknown = {}): Promise<T> {
    const url = this.opts.url;

    const body = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params,
    };

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? 30_000,
    );

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      console.error(`[rpc] fetch to ${url} failed:`, err);
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new RpcError(-32000, `HTTP ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as
      | { result: T; error?: undefined }
      | {
        result?: undefined;
        error: { code: number; message: string; data?: unknown };
      };

    if ("error" in json && json.error) {
      throw new RpcError(json.error.code, json.error.message, json.error.data);
    }
    return json.result as T;
  }

  // =========================================================================
  // Chain
  // =========================================================================

  chainId() {
    return this.call<ChainIdResponse>("chainId");
  }

  blockNumber() {
    return this.call<BlockNumberResponse>("blockNumber");
  }

  getBlockByNumber(height: HexString | number, full = false) {
    return this.call<Block>("getBlockByNumber", {
      height: typeof height === "number" ? toHex(height) : height,
      full,
    });
  }

  getBlockByHash(hash: HashHex, full = false) {
    return this.call<Block>("getBlockByHash", { hash, full });
  }

  getBlockHeaderByNumber(height: HexString | number) {
    return this.call<BlockHeader>("getBlockHeaderByNumber", {
      height: typeof height === "number" ? toHex(height) : height,
    });
  }

  getStateRoot(height: HexString | number) {
    return this.call<StateRootResponse>("getStateRoot", {
      height: typeof height === "number" ? toHex(height) : height,
    });
  }

  getRecentBlocks(limit = 10) {
    return this.call<RecentBlocksResponse>("getRecentBlocks", { limit });
  }

  getBlocksRange(
    start: HexString | number,
    count = 50,
    order: "asc" | "desc" = "desc",
  ) {
    return this.call<BlocksRangeResponse>("getBlocksRange", {
      start: typeof start === "number" ? toHex(start) : start,
      count,
      order,
    });
  }

  getBlocksByProducer(address: Bech32mAddress, limit = 50) {
    return this.call<BlocksByProducerResponse>("getBlocksByProducer", {
      address,
      limit,
    });
  }

  getBlockStats(fromHeight: HexString | number, toHeight: HexString | number) {
    return this.call<BlockStats>("getBlockStats", {
      from_height: typeof fromHeight === "number" ? toHex(fromHeight) : fromHeight,
      to_height: typeof toHeight === "number" ? toHex(toHeight) : toHeight,
    });
  }

  getChainStats() {
    return this.call<ChainStats>("getChainStats");
  }

  getEpochInfo() {
    return this.call<EpochInfo>("getEpochInfo");
  }

  getEpochSchedule() {
    return this.call<EpochSchedule>("getEpochSchedule");
  }

  // =========================================================================
  // State / accounts
  // =========================================================================

  getBalance(address: Bech32mAddress, tokenId?: HexString) {
    return this.call<BalanceResponse>("getBalance", {
      address,
      ...(tokenId ? { token_id: tokenId } : {}),
    });
  }

  getAccount(address: Bech32mAddress) {
    return this.call<Account>("getAccount", { address });
  }

  getNonce(address: Bech32mAddress) {
    return this.call<NonceResponse>("getNonce", { address });
  }

  getTokensForAddress(address: Bech32mAddress) {
    return this.call<TokensForAddressResponse>("getTokensForAddress", {
      address,
    });
  }

  getPositionsForAddress(address: Bech32mAddress) {
    return this.call<PositionsForAddressResponse>("getPositionsForAddress", {
      address,
    });
  }

  getOrdersForAddress(address: Bech32mAddress, includeFilled = false) {
    return this.call<OrdersForAddressResponse>("getOrdersForAddress", {
      address,
      include_filled: includeFilled,
    });
  }

  getTransactionsForAddress(address: Bech32mAddress, limit = 50) {
    return this.call<TransactionsForAddressResponse>(
      "getTransactionsForAddress",
      { address, limit },
    );
  }

  getStakingInfo() {
    return this.call<StakingInfo>("getStakingInfo");
  }

  getAddressStats(address: Bech32mAddress) {
    return this.call<AddressStats>("getAddressStats", { address });
  }

  getAddressList(limit = 50, offset = 0) {
    return this.call<AddressListResponse>("getAddressList", {
      limit,
      offset,
    });
  }

  getProof(args: {
    key_type: number;
    key_bytes: HexString;
    version?: HexString | "current";
  }) {
    return this.call<ProofResponse>("getProof", args);
  }

  // =========================================================================
  // Tokens
  // =========================================================================

  getTokenInfo(tokenId: HexString) {
    return this.call<TokenInfo>("getTokenInfo", { token_id: tokenId });
  }

  getTokenSupply(tokenId: HexString) {
    return this.call<TokenSupplyResponse>("getTokenSupply", {
      token_id: tokenId,
    });
  }

  getAllTokens(limit = 50, offset = 0) {
    return this.call<AllTokensResponse>("getAllTokens", { limit, offset });
  }

  getTokenHolders(tokenId: HexString, limit = 50) {
    return this.call<TokenHoldersResponse>("getTokenHolders", {
      token_id: tokenId,
      limit,
    });
  }

  getTokenTransfers(tokenId: HexString, limit = 50) {
    return this.call<TokenTransfersResponse>("getTokenTransfers", {
      token_id: tokenId,
      limit,
    });
  }

  getTokensByCreator(address: Bech32mAddress, limit = 50) {
    return this.call<TokensByCreatorResponse>("getTokensByCreator", {
      address,
      limit,
    });
  }

  // =========================================================================
  // Transactions
  // =========================================================================

  sendRawTransaction(txHex: HexString) {
    return this.call<SendTxResponse>("sendRawTransaction", { tx: txHex });
  }

  getTransactionByHash(hash: HashHex) {
    return this.call<TransactionWithLocation>("getTransactionByHash", {
      hash,
    });
  }

  getTransactionReceipt(hash: HashHex) {
    return this.call<Receipt>("getTransactionReceipt", { hash });
  }

  simulateTransaction(txHex: HexString) {
    return this.call<SimulateResponse>("simulateTransaction", { tx: txHex });
  }

  getRecentTransactions(limit = 10, typeCode?: number) {
    return this.call<RecentTransactionsResponse>("getRecentTransactions", {
      limit,
      ...(typeCode !== undefined ? { type_code: typeCode } : {}),
    });
  }

  getAllTransactions(limit = 50, typeCode?: number) {
    return this.call<RecentTransactionsResponse>("getAllTransactions", {
      limit,
      ...(typeCode !== undefined ? { type_code: typeCode } : {}),
    });
  }

  getTransactionsByType(typeCode: number, limit = 50) {
    return this.call<RecentTransactionsResponse>("getTransactionsByType", {
      type_code: typeCode,
      limit,
    });
  }

  getTxCount() {
    return this.call<TxCount>("getTxCount");
  }

  // =========================================================================
  // Mempool
  // =========================================================================

  getMempoolStats() {
    return this.call<MempoolStats>("getMempoolStats");
  }

  // Returns null when the tx isn't in the mempool. This is the one
  // method on the RPC surface that returns null rather than throwing
  // on a miss; the client preserves that behavior verbatim.
  getMempoolTx(hash: HashHex) {
    return this.call<Transaction | null>("getMempoolTx", { hash });
  }

  getMempoolList(limit = 50, orderBy: "fee" | "time" = "fee") {
    return this.call<MempoolListResponse>("getMempoolList", {
      limit,
      order_by: orderBy,
    });
  }

  // =========================================================================
  // Consensus
  // =========================================================================

  // The C++ handler returns a bare array when no pagination is applied
  // and a {validators, count, total} object otherwise. The client
  // normalizes both to the wrapped form so no caller has to branch.
  async getValidators(
    activeOnly = false,
    limit = 100,
    offset = 0,
  ): Promise<ValidatorListResponse> {
    const raw = await this.call<
      Validator[] | ValidatorListResponse
    >("getValidators", { active_only: activeOnly, limit, offset });

    if (Array.isArray(raw)) {
      const count = raw.length;
      return {
        validators: raw,
        count: toHex(count),
        total: toHex(count),
      };
    }
    return raw;
  }

  getValidator(id: HexString) {
    return this.call<Validator>("getValidator", { id });
  }

  getValidatorByAddress(address: Bech32mAddress) {
    return this.call<Validator>("getValidatorByAddress", { address });
  }

  getValidatorStats(id: HexString) {
    return this.call<ValidatorWithBlocks>("getValidatorStats", { id });
  }

  getActiveSet() {
    return this.call<ActiveSetResponse>("getActiveSet");
  }

  getConsensusState() {
    return this.call<ConsensusState>("getConsensusState");
  }

  // =========================================================================
  // AMM
  // =========================================================================

  getPool(poolId: HexString) {
    return this.call<AmmPool>("getPool", { pool_id: poolId });
  }

  getPosition(positionId: HexString) {
    return this.call<AmmPosition>("getPosition", {
      position_id: positionId,
    });
  }

  getPositionByOwner(address: Bech32mAddress, poolId: HexString) {
    return this.call<AmmPosition>("getPositionByOwner", {
      address,
      pool_id: poolId,
    });
  }

  getAllPools(limit = 50, offset = 0) {
    return this.call<AllPoolsResponse>("getAllPools", { limit, offset });
  }

  getPoolsForToken(tokenId: HexString) {
    return this.call<PoolsForTokenResponse>("getPoolsForToken", {
      token_id: tokenId,
    });
  }

  getPositionsForPool(poolId: HexString, limit = 50) {
    return this.call<PositionsForPoolResponse>("getPositionsForPool", {
      pool_id: poolId,
      limit,
    });
  }

  // =========================================================================
  // Orders
  // =========================================================================

  getOrder(orderId: HexString) {
    return this.call<Order>("getOrder", { order_id: orderId });
  }

  getOrdersExpiringAt(height: HexString | number) {
    return this.call<OrdersExpiringAtResponse>("getOrdersExpiringAt", {
      height: typeof height === "number" ? toHex(height) : height,
    });
  }

  getAllOrders(limit = 50, offset = 0, includeFilled = false) {
    return this.call<AllOrdersResponse>("getAllOrders", {
      limit,
      offset,
      include_filled: includeFilled,
    });
  }

  getOrdersByPair(
    sellToken: HexString,
    buyToken: HexString,
    limit = 50,
    offset = 0,
  ) {
    return this.call<OrdersByPairResponse>("getOrdersByPair", {
      sell_token: sellToken,
      buy_token: buyToken,
      limit,
      offset,
    });
  }

  // =========================================================================
  // Metrics (server-side aggregate methods, not the Prometheus endpoint)
  // =========================================================================

  getFeeStats() {
    return this.call<FeeStats>("getFeeStats");
  }

  getPotInfo() {
    return this.call<PotInfo>("getPotInfo");
  }

  // =========================================================================
  // Node
  // =========================================================================

  ping() {
    return this.call<string>("ping");
  }

  status() {
    return this.call<NodeStatus>("status");
  }

  health() {
    return this.call<HealthResponse>("health");
  }

  getPeers() {
    return this.call<PeersResponse>("getPeers");
  }

  getConfig() {
    return this.call<Record<string, unknown>>("getConfig");
  }

  getMethods() {
    return this.call<Record<string, string[]>>("getMethods");
  }

  // =========================================================================
  // Ethereum-style shims
  // =========================================================================

  web3ClientVersion() {
    return this.call<string>("web3_clientVersion");
  }

  netVersion() {
    return this.call<string>("net_version");
  }

  netPeerCount() {
    return this.call<HexString>("net_peerCount");
  }

  netListening() {
    return this.call<boolean>("net_listening");
  }
}

function toHex(n: number): HexString {
  return "0x" + n.toString(16);
}