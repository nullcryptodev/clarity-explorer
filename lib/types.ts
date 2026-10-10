// Wire conventions
//
//  HexString  - "0x"-prefixed lowercase hex, no leading zeros. Zero = "0x0".
//               Used for: balances, fees, stake, heights, nonces, token IDs,
//               reserves, supplies, amounts, hashes (fixed 64), signatures
//               (fixed 128), public keys (fixed 64), byte blobs.
//  Bech32m    - "clrty1..." | "tclrty1..." | "rclrty1...".
//               Used for: account addresses, validator reward addresses.
//  number     - JSON number. Only for counts, small enums, and bps values.
//               Never for anything that could exceed 2^53.
//  boolean    - JSON boolean.

export type HexString = string;      // "0x..."
export type Bech32mAddress = string; // "clrty1..." etc.
export type HashHex = string;        // "0x" + 64 hex
export type PublicKeyHex = string;   // "0x" + 64 hex (same shape as hash)
export type SignatureHex = string;   // "0x" + 128 hex
export type BlockHeight = HexString; // hex string, not a number

// Account

export interface Account {
  address: Bech32mAddress;      // added by getAccount handler, not the encoder
  nonce: HexString;
  balance: HexString;
  staked: HexString;
  pending_rewards: HexString;
  last_reward_epoch: HexString;
  staker_since_height: HexString;
  created_at_height: HexString;
  staking_opted_out: boolean;
  is_empty: boolean;            // derived
  total_value: HexString;       // balance + pending_rewards, derived
}

// Block header

export interface BlockHeader {
  hash: HashHex;                // computed
  version: number;
  chain_id: number;
  height: HexString;
  parent_hash: HashHex;
  timestamp_ms: HexString;
  proposer: Bech32mAddress;
  epoch: HexString;
  rotation_index: HexString;
  commit_round: HexString;      // NOT part of the hash
  emergency_rotation: HexString;// IS part of the hash
  state_root: HashHex;
  tx_root: HashHex;
  receipts_root: HashHex;
  validator_set_root: HashHex;
  total_fees: HexString;
  tx_count: number;
  active_validator_count: number;
}

export interface QuorumSignature {
  signer_index: number;
  signature: SignatureHex;
}

export interface Block extends BlockHeader {
  transactions: Transaction[] | HashHex[]; // objects if `full`, else hashes
  participants: HexString[];               // validator ids, hex
  quorum_signatures: QuorumSignature[];
}

// Transaction

export type TxTypeName =
  | "transfer"
  | "opt_in_staking"
  | "opt_out_staking"
  | "claim_rewards"
  | "register_validator"
  | "unregister_validator"
  | "update_reward_address"
  | "create_pool"
  | "add_liquidity"
  | "remove_liquidity"
  | "swap"
  | "create_order"
  | "cancel_order"
  | "create_token"
  | "mint_token"
  | "burn_token"
  | "update_token_meta"
  | "block_reward"
  | "order_expired"
  | "slash"
  | string; // future-proof

export interface Transaction {
  hash: HashHex;                // txid == signingHash
  version: number;
  chain_id: HexString;
  type: TxTypeName;
  type_code: number;
  nonce: HexString;
  valid_until_height: HexString; // 0 = no expiry
  from: Bech32mAddress;
  to: Bech32mAddress | null;     // null for txs without a recipient
  token_id: HexString;
  amount: HexString;
  fee: HexString;
  payload: HexString;
  payload_size: number;
  signature: SignatureHex;
}

// Receipt

export interface Receipt {
  status: "success" | "failure";
  status_code: number;   // 0 | 1
  fee_paid: HexString;
  // Added by getTransactionReceipt handler, not the encoder:
  tx_hash: HashHex;
  block_hash: HashHex;
  block_height: HexString;
  index: number;
}

// Validator
// Two-key model: `reward_address` is bech32m; `consensus_key` and
// `node_key` are raw 0x-hex signing keys.

export interface Validator {
  id: HexString;
  reward_address: Bech32mAddress;
  consensus_key: PublicKeyHex;   // signing key, NOT an address
  node_key: PublicKeyHex;
  owner: Bech32mAddress;
  registered_at_height: HexString;
  stake: HexString;
  uptime_score: number;          // bps
  last_ping_height: HexString;
  last_seen_height: HexString;
  reward_multiplier: number;     // bps, floor 2000
  infraction_count: number;
  last_infraction_height: HexString;
  total_blocks_produced: HexString;
  total_rewards_earned: HexString;
  epochs_active: HexString;
  is_seed: boolean;
  is_active: boolean;
  became_active_at: HexString;
  last_active_at: HexString;
  can_be_active: boolean;        // derived
  meets_stake_req: boolean;      // derived
  is_offline: boolean;           // derived, needs current height
}

// Token

export type BackingModel = "unbacked" | "backed" | "hybrid";

export interface TokenInfo {
  id: HexString;
  name: string;
  symbol: string;
  decimals: number;
  creator: Bech32mAddress | null; // null for native token (id 0)
  backing: BackingModel;
  backing_code: number;
  max_supply: HexString;          // "0x0" = unlimited
  royalty_bps: number;
  fingerprint: HashHex | null;
  is_native: boolean;             // derived
  is_bridged: boolean;            // derived
}

// AMM

export interface AmmPool {
  id: HexString;
  creator: Bech32mAddress;
  token_a: HexString;
  token_b: HexString;
  reserve_a: HexString;
  reserve_b: HexString;
  total_liquidity: HexString;
  fee_bps: number;
  created_at_height: HexString;
  active: boolean;
  k: HexString;                   // 128-bit product, may exceed 2^53
}

export interface AmmPosition {
  id: HexString;
  owner: Bech32mAddress;
  pool_id: HexString;
  liquidity: HexString;
  created_at_height: HexString;
  share_bps?: number;             // omitted if pool not supplied
}

// Order

export type OrderMode = "passive" | "active";
export type OrderConditionType =
  | "expires_at_height"
  | "price_above"
  | "price_below"
  | "volume_below"
  | "balance_below"
  | "invalid";

export interface OrderCondition {
  type: OrderConditionType;
  type_code: number;
  param1: HexString;
  param2: HexString;
  description: string;            // human-readable
}

export interface Order {
  id: HexString;
  owner: Bech32mAddress;
  mode: OrderMode;
  mode_code: number;
  sell_token: HexString;
  buy_token: HexString;
  sell_amount: HexString;
  min_buy_amount: HexString;
  filled_amount: HexString;
  remaining_amount: HexString;    // derived
  created_at_height: HexString;
  order_expires_at_height: HexString;
  is_fully_filled: boolean;       // derived
  condition_count: number;
  conditions: OrderCondition[];
}

// Status / consensus / peers

export interface NodeStatus {
  height: HexString;
  best_peer_height: HexString;
  peer_count: HexString;
  mempool_size: HexString;
  mempool_bytes: HexString;
  is_validator: boolean;
  validator_id: HexString;
  consensus_height: HexString;
  consensus_round: HexString;
  consensus_step: string;
  network: string;                // "mainnet" | "testnet" | "regtest"
  chain_id: HexString;
  running: boolean;
  state_root: HashHex;
}

export interface ConsensusState {
  height: HexString;
  round: HexString;
  step: string;
  is_validator: boolean;
  validator_id: HexString;
  chain_height: HexString;
  best_peer_height: HexString;
}

export interface MempoolStats {
  total_txs: HexString;
  priority_txs: HexString;
  standard_txs: HexString;
  total_bytes: HexString;
  min_fee_rate: HexString;
  max_fee_rate: HexString;
  avg_fee_rate: HexString;
}

export interface Peer {
  id: HexString;
  ip: string;
  port: number;
  direction: "inbound" | "outbound";
  state: string;
  best_height: HexString;
  agent: string;
  connected_at_ms: HexString;
  last_recv_ms: HexString;
  last_send_ms: HexString;
  misbehaviors: HexString;
}

// Proof

export type ProofStatus =
  | "ok"
  | "key_not_found"
  | "version_unavailable"
  | "malformed";

export interface ProofResponse {
  status: ProofStatus;
  state_root: HashHex;
  version: HexString;
  proof?: HexString;              // present only when status === "ok"
}

// Wrapper returned by getTransactionByHash

export interface TransactionWithLocation {
  tx: Transaction;
  status: "pending" | "confirmed";
  block_hash: HashHex | null;
  block_height: HexString | null;
  index: number | null;
}