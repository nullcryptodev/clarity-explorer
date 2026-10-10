import { KEYSTORE_1, KEYSTORE_2, PASSWORD_FILE_1, PASSWORD_FILE_2, RPC_URL, SEED_1_ADDRESS, SEED_2_ADDRESS, SIGNER_BIN } from "@/lib/utils"
import { NextRequest, NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// POST /api/spam-tx
//
// Fires a burst of transactions at the node to measure throughput.
//
// Devnet only. Do not deploy.
//
// Body:
//  {
//    from_seed?: 1 | 2,     // which seed keystore to sign with (default 1)
//    type?: string,         // transaction type (default "transfer")
//    count?: number,        // how many to fire (default 10, max 500)
//    fee?: string,          // fee in CLRTY (default "1")
//    to?: string,           // only for type="transfer"
//    amount?: string,       // only for type="transfer"
//    concurrency?: number,  // how many signer subprocesses at once
//                           // (default 4, max 32)
//  }
//
// Returns:
//  {
//    submitted: number,
//    accepted: number,
//    rejected: number,
//    rejections: { reason: count },
//    elapsed_ms: number,
//    tps: number,
//    first_tx: string|null,
//    last_tx: string|null,
//  }
//
// What "tps" measures here:
//
//  The tps figure is accepted-per-second of the *submission* path,
//  not the *commit* path. The bottleneck for a burst from this
//  route is the per-transaction signer subprocess (execFile per tx,
//  each one paying Argon2id KDF cost), not the node or the network.
//
//  The number is useful for "can the node absorb rapid submission"
//  but not for "what is the chain's maximum TPS". For the latter,
//  watch clrty_height and clrty_mempool_txs on the metrics endpoint
//  while the burst is draining.
//
// The nonce sequence is computed once at the start (base = current
// on-chain nonce) and incremented per submission. That's what makes a
// burst work: without it, every submission would query the same
// on-chain nonce and 19 of 20 would reject as nonce-conflict.
//
// The route does NOT use a shared nonce counter between concurrent
// invocations. Two overlapping spam requests will collide on the same
// nonce range. Callers should ensure only one spam is in flight at a
// time; the DevTools UI disables the button while busy.
// ---------------------------------------------------------------------------

const MAX_COUNT = 500
const MAX_CONCURRENCY = 32

interface Body {
  from_seed?: 1 | 2
  type?: string
  count?: number
  fee?: string
  to?: string
  amount?: string
  concurrency?: number
}

export async function POST(req: NextRequest) {
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

  const count = body.count ?? 10
  if (!Number.isFinite(count) || count < 1 || count > MAX_COUNT) {
    return NextResponse.json(
      { error: `count must be 1..${MAX_COUNT}` },
      { status: 400 },
    )
  }

  const concurrency = body.concurrency ?? 4
  if (
    !Number.isFinite(concurrency) ||
    concurrency < 1 ||
    concurrency > MAX_CONCURRENCY
  ) {
    return NextResponse.json(
      { error: `concurrency must be 1..${MAX_CONCURRENCY}` },
      { status: 400 },
    )
  }

  const txType = body.type ?? "transfer"
  const fee = body.fee ?? "1"
  const keystore = seedNum === 2 ? KEYSTORE_2 : KEYSTORE_1
  const passwordFile = seedNum === 2 ? PASSWORD_FILE_2 : PASSWORD_FILE_1
  const senderAddress = seedNum === 2 ? SEED_2_ADDRESS : SEED_1_ADDRESS

  // ---- 1. Fetch the starting nonce once ----

  let baseNonce: bigint
  try {
    const nonceResp = await rpc<NodeNonce>("getNonce", {
      address: senderAddress,
    })
    baseNonce = BigInt(nonceResp.nonce)
  } catch (err) {
    return NextResponse.json(
      { error: `failed to fetch nonce: ${errMsg(err)}` },
      { status: 502 },
    )
  }

  // ---- 2. Fire the burst ----

  const startedAt = Date.now()
  const rejections: Record<string, number> = {}
  let accepted = 0
  let firstTx: string | null = null
  let lastTx: string | null = null

  const transferDefaults = (() => {
    if (txType !== "transfer") return null
    const otherSeedAddress = seedNum === 2 ? SEED_1_ADDRESS : SEED_2_ADDRESS
    const to = body.to ?? process.env.CLARITY_TEST_TO_ADDRESS ?? otherSeedAddress
    const amount = body.amount ?? process.env.CLARITY_TEST_AMOUNT ?? "1"
    return { to, amount }
  })()

  async function submitOne(
    index: number,
  ): Promise<{ ok: true; hash: string } | { ok: false; reason: string }> {
    const nonce = baseNonce + BigInt(index)

    const cliArgs: string[] = [
      "sign",
      txType,
      "--keystore", keystore,
      "--password-file", passwordFile,
      "--nonce", nonce.toString(),
      "--fee", fee,
      "--raw",
    ]

    if (txType === "transfer" && transferDefaults) {
      cliArgs.push("--to", transferDefaults.to, "--amount", transferDefaults.amount)
    }

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
      return { ok: false, reason: classifySignerError(detail) }
    }

    if (!rawHex.startsWith("0x")) {
      return { ok: false, reason: "signer-output-malformed" }
    }

    try {
      const result = await rpc<{ tx_hash: string; accepted: true }>(
        "sendRawTransaction",
        { tx: rawHex },
      )
      return { ok: true, hash: result.tx_hash }
    } catch (err) {
      return { ok: false, reason: classifyRpcError(errMsg(err)) }
    }
  }

  // Bounded-concurrency dispatch. Workers pull indexes from a
  // shared cursor until the count is exhausted.
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++
      if (i >= count) return

      const result = await submitOne(i)

      if (result.ok) {
        accepted++
        if (firstTx === null) firstTx = result.hash
        lastTx = result.hash
      } else {
        rejections[result.reason] = (rejections[result.reason] ?? 0) + 1
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)

  const elapsedMs = Date.now() - startedAt
  const elapsedSec = elapsedMs / 1000
  const rejected = count - accepted
  const tps = elapsedSec > 0 ? accepted / elapsedSec : 0

  return NextResponse.json({
    submitted: count,
    accepted,
    rejected,
    rejections,
    elapsed_ms: elapsedMs,
    tps: Number(tps.toFixed(2)),
    first_tx: firstTx,
    last_tx: lastTx,
  })
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

// Compress a signer error string into a stable category. The
// signer writes human-readable errors to stderr; we want the
// spam breakdown to group them by kind, not print every instance.
function classifySignerError(detail: string): string {
  const lower = detail.toLowerCase()
  if (lower.includes("insufficient")) return "insufficient-funds"
  if (lower.includes("nonce")) return "nonce"
  if (lower.includes("not a valid address")) return "bad-address"
  if (lower.includes("password")) return "bad-password"
  if (lower.includes("keystore")) return "keystore"
  return "signer-error"
}

// Same idea for RPC errors.
function classifyRpcError(detail: string): string {
  const lower = detail.toLowerCase()
  if (lower.includes("nonce-too-low")) return "nonce-too-low"
  if (lower.includes("nonce-conflict")) return "nonce-conflict"
  if (lower.includes("insufficient-funds")) return "insufficient-funds"
  if (lower.includes("pool-full")) return "pool-full"
  if (lower.includes("low-fee")) return "low-fee"
  if (lower.includes("high-fee")) return "high-fee"
  if (lower.includes("already")) return "already-in-pool"
  if (lower.includes("malformed")) return "malformed"
  return "rpc-error"
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"