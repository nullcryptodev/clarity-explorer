export { cn } from "cn"

// These are example values for anyone that has found themselves here

export const RPC_URL =
  process.env.CLARITY_RPC_URL ?? "http://127.0.0.1:9633"

export const SIGNER_BIN =
  process.env.CLARITY_SIGNER_BIN ?? "CLRTY/build/src/Apps/Tools/transaction_signer"

export const KEYSTORE_1 =
  process.env.CLARITY_TEST_KEYSTORE_1 ?? "regtest_1.ks"

export const KEYSTORE_2 =
  process.env.CLARITY_TEST_KEYSTORE_2 ?? "regtest_2.ks"

export const PASSWORD_FILE_1 =
  process.env.CLARITY_TEST_PASSWORD_FILE_1 ?? "regtest_1.pw"

export const PASSWORD_FILE_2 =
  process.env.CLARITY_TEST_PASSWORD_FILE_2 ?? "regtest_2.pw"

// Reward addresses for the two seed validators. These are the
// regtest-HRP bech32m encodings of the same pubkeys the keystores
// above hold. If the keystores are regenerated (address --new),
// these must be updated to the new regtest addresses at the same
// time, or the nonce lookup and the sender address inside the
// signed transaction will disagree and every submission will be
// rejected as a signature failure.
export const SEED_1_ADDRESS =
  process.env.CLARITY_TEST_ADDRESS_1 ??
  "rclrty1qrcz7k34mlz77695k9sagcr0y5ywwx2rfd9v788gw5pv2380lnckuq3p6al"

export const SEED_2_ADDRESS =
  process.env.CLARITY_TEST_ADDRESS_2 ??
  "rclrty1qr94782lsd55xdmz4zhhha7y36t6rlag92ua49ce535qm5z4vz68urdv3jn"
