// Every value here mirrors a constant in GlobalConfig.h or RewardTypes.h.
// If the C++ side changes, this file must change with it — there's no
// runtime bridge and no version handshake.
// All arithmetic uses BigInt to avoid precision loss above 2^53.

import { bigIntToHex } from "./format"

// Currency

export const ATOMIC_UNITS_PER_COIN = BigInt(100_000) // 1 CLRTY = 100,000 atomic
export const DECIMALS = 5

// Block reward

export const BLOCK_REWARD = ATOMIC_UNITS_PER_COIN * BigInt(10) // 10 CLRTY

// Reward split in basis points

const STAKER_SHARE_BPS = BigInt(4000) // 40% of block reward
const VALIDATOR_SHARE_BPS = BigInt(6000) // 60% of block reward
const PRODUCER_BONUS_BPS = BigInt(2000) // 20% of validator pool
const SET_SHARE_BPS = BigInt(8000) // 80% of validator pool
export const MAX_BPS = BigInt(10_000)

// REWARD_SPLIT
//
// The nominal per-block split. Every block pays the same total; the
// per-validator distribution varies with the active set, but the total
// allocations to each pool are fixed.
//
//  total          10 CLRTY
//  stakerPool      4 CLRTY
//  validatorPool   6 CLRTY
//  producerBonus   1.2 CLRTY (20% of validatorPool)
//  setShare        4.8 CLRTY (80% of validatorPool)

export const REWARD_SPLIT = (() => {
  const stakerPool = (BLOCK_REWARD * STAKER_SHARE_BPS) / MAX_BPS
  const validatorPool = (BLOCK_REWARD * VALIDATOR_SHARE_BPS) / MAX_BPS
  const producerBonus = (validatorPool * PRODUCER_BONUS_BPS) / MAX_BPS
  const setShare = (validatorPool * SET_SHARE_BPS) / MAX_BPS

  return {
    total: BLOCK_REWARD,
    stakerPool,
    validatorPool,
    producerBonus,
    setShare,
  }
})()

// The effective APY at any epoch is:
//
//  min(
//    APY_BASE_BPS + activityBonus + potBonus,
//    APY_MAX_BPS
//  )
//
// where:
//  base       constant, always applied
//  activity   scales with recent transaction throughput
//  potBonus   scales with how full the pot is relative to POT_HIGH

export const APY_BASE_BPS = BigInt(500) // 5.00%
export const APY_ACTIVITY_MAX_BPS = BigInt(500) // +5.00% max
export const APY_POT_BONUS_MAX_BPS = BigInt(300) // +3.00% max
export const APY_MAX_BPS = APY_BASE_BPS + APY_ACTIVITY_MAX_BPS + APY_POT_BONUS_MAX_BPS // 13.00%

// Staking

export const AUTO_STAKE_THRESHOLD = ATOMIC_UNITS_PER_COIN * BigInt(100) // 100 CLRTY
export const BALANCE_BONUS_THRESHOLD = ATOMIC_UNITS_PER_COIN * BigInt(1000) // 1000 CLRTY
export const BALANCE_BONUS_BPS = BigInt(300) // +3% weight for large stakers

// Validator

export const VALIDATOR_MIN_STAKE = ATOMIC_UNITS_PER_COIN * BigInt(1000) // 1000 CLRTY
export const ACTIVE_SET_MIN = 2
export const ACTIVE_SET_MAX = 100
export const ACTIVE_SET_DEFAULT = 11

// Timing

export const ROTATION_INTERVAL = BigInt(60) // blocks per epoch
export const NOMINAL_BLOCK_SECONDS = BigInt(1)
export const SECONDS_PER_EPOCH = ROTATION_INTERVAL * NOMINAL_BLOCK_SECONDS
export const SECONDS_PER_YEAR = BigInt(31_556_952) // 365.2425 days, Gregorian

// The pot accumulates staker rewards when activity is low and releases
// them when activity is high. The thresholds are expressed in "epochs'
// worth of staker pool":
//
//  POT_LOW    1 week of undistributed rewards
//  POT_HIGH   1 month; pot bonus APY starts above this
//  POT_MAX    3 months; excess is burned above this
//
// Computed here using the same formulas as the C++ constants, so the
// client doesn't have to know the exact block times to display the
// thresholds.

const SECONDS_PER_WEEK = BigInt(7 * 24 * 3600)
const SECONDS_PER_MONTH = BigInt(30 * 24 * 3600)
const SECONDS_PER_QUARTER = BigInt(90 * 24 * 3600)

export const POT_LOW_EPOCHS = SECONDS_PER_WEEK / SECONDS_PER_EPOCH
export const POT_HIGH_EPOCHS = SECONDS_PER_MONTH / SECONDS_PER_EPOCH
export const POT_MAX_EPOCHS = SECONDS_PER_QUARTER / SECONDS_PER_EPOCH

// Rotation and unbonding

export const UNBONDING_PERIOD = BigInt(2) * ROTATION_INTERVAL // 120 blocks
export const EMERGENCY_ROTATION_ROUNDS = BigInt(30)

// Packed ASCII: 'CLRT', 'CLTT', 'CLRG'. Compare against the numeric
// chain_id returned by the RPC's status() method.

export const CHAIN_ID_MAINNET = 0x434c5254 // 'CLRT'
export const CHAIN_ID_TESTNET = 0x434c5454 // 'CLTT'
export const CHAIN_ID_REGTEST = 0x434c5247 // 'CLRG'

// Helpers

// Compute the pot fill as a fraction of POT_HIGH, in basis points.
// The pot bonus APY only applies above POT_HIGH, so this is what a
// user actually wants to see: how far past the threshold they are.
//
// Returns a plain number (not BigInt) because it's always a small
// percentage; callers typically render it as "X.XX%".
export function potFillBps(pot: bigint): number {
  const poolBaseline =
    (BLOCK_REWARD * STAKER_SHARE_BPS) / MAX_BPS * ROTATION_INTERVAL
  const potHigh = poolBaseline * POT_HIGH_EPOCHS
  if (potHigh === BigInt(0)) return 0

  const bps = (pot * BigInt(10_000)) / potHigh
  return Number(bps)
}

// Convert a raw APY in basis points to a display string with two
// decimals. 1300 → "13.00%".
export function formatApyBps(bps: bigint | number): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps
  return `${(n / 100).toFixed(2)}%`
}

// Re-export bigIntToHex so consumers can import everything they need
// from one module if they prefer.
export { bigIntToHex }