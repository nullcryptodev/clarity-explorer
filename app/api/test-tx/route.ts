import { KEYSTORE_1, KEYSTORE_2, PASSWORD_FILE_1, PASSWORD_FILE_2, RPC_URL, SEED_1_ADDRESS, SEED_2_ADDRESS, SIGNER_BIN } from "@/lib/utils"
import { NextRequest, NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// POST /api/test-tx
//
// Signs a single transaction using the transaction_signer CLI, then
// submits the resulting hex to the node via sendRawTransaction.
//
// Development-only. Do not deploy.
//
// Body (all optional):
//  {
//    from_seed: 1 | 2,      // which seed keystore to sign with
//    type: "transfer" | "opt-in-staking" | "opt-out-staking" | "claim-rewards",
//    to: string,            // bech32m; only for type="transfer"
//    amount: string,        // decimal CLRTY; only for type="transfer"
//    fee: string,           // decimal CLRTY
//  }
//
// Returns:
//  { tx_hash, nonce, raw_hex } on success
//  { error }                   on failure
// ---------------------------------------------------------------------------

type TxType =
  | "transfer"
  | "opt-in-staking"
  | "opt-out-staking"
  | "claim-rewards"

interface Body {
  from_seed?: 1 | 2
  type?: TxType
  to?: string
  amount?: string
  fee?: string
}

export async function POST(req: NextRequest) {
  if (!SIGNER_BIN) {
    return NextResponse.json(
      { error: "CLARITY_SIGNER_BIN is not configured" },
      { status: 500 },
    )
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    // empty body is fine — use defaults
  }

  const seedNum =
    body.from_seed ?? Number(process.env.CLARITY_TEST_FROM_SEED ?? 1)
  if (seedNum !== 1 && seedNum !== 2) {
    return NextResponse.json(
      { error: "from_seed must be 1 or 2" },
      { status: 400 },
    )
  }

  const keystore = seedNum === 2 ? KEYSTORE_2 : KEYSTORE_1
  const passwordFile = seedNum === 2 ? PASSWORD_FILE_2 : PASSWORD_FILE_1
  const senderAddress = seedNum === 2 ? SEED_2_ADDRESS : SEED_1_ADDRESS

  const txType: TxType = body.type ?? "transfer"
  const fee = body.fee ?? process.env.CLARITY_TEST_FEE ?? "1"

  // ---- 1. Get the sender's current nonce ----

  let nonce: bigint
  try {
    const nonceResp = await rpc<NodeNonce>("getNonce", {
      address: senderAddress,
    })
    nonce = BigInt(nonceResp.nonce)
  } catch (err) {
    return NextResponse.json(
      { error: `failed to fetch nonce: ${errMsg(err)}` },
      { status: 502 },
    )
  }

  // ---- 2. Build the CLI arguments ----

  const cliArgs: string[] = [
    "sign",
    txType,
    "--keystore", keystore,
    "--password-file", passwordFile,
    "--nonce", nonce.toString(),
    "--fee", fee,
    "--raw",
  ]

  if (txType === "transfer") {
    const otherSeedAddress = seedNum === 2 ? SEED_1_ADDRESS : SEED_2_ADDRESS
    const to = body.to ?? process.env.CLARITY_TEST_TO_ADDRESS ?? otherSeedAddress
    const amount = body.amount ?? process.env.CLARITY_TEST_AMOUNT ?? "1"

    cliArgs.push("--to", to, "--amount", amount)
  }

  // ---- 3. Run the signer ----

  let rawHex: string
  try {
    const { stdout } = await execFileAsync(SIGNER_BIN, cliArgs, {
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    })
    rawHex = stdout.trim()
  } catch (err) {
    const e = err as { stderr?: string; message?: string }
    const detail = (e.stderr ?? e.message ?? "unknown error").trim()
    return NextResponse.json(
      { error: `signer failed: ${detail}` },
      { status: 500 },
    )
  }

  if (!rawHex.startsWith("0x")) {
    return NextResponse.json(
      { error: `signer produced unexpected output: ${rawHex.slice(0, 80)}` },
      { status: 500 },
    )
  }

  // ---- 4. Submit to the node ----

  try {
    const result = await rpc<{ tx_hash: string; accepted: true }>(
      "sendRawTransaction",
      { tx: rawHex },
    )
    return NextResponse.json({
      tx_hash: result.tx_hash,
      nonce: nonce.toString(),
      raw_hex: rawHex,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `sendRawTransaction rejected: ${errMsg(err)}` },
      { status: 502 },
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NodeNonce {
  address: string
  nonce: string
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(`${RPC_URL}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as
    | { result: T; error?: undefined }
    | { result?: undefined; error: { code: number; message: string } }

  if ("error" in json && json.error) {
    throw new Error(`${json.error.code}: ${json.error.message}`)
  }
  return (json as { result: T }).result
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"