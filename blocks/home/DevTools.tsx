"use client"

import { FC, useState } from "react"

type SpamResult = {
  submitted: number
  accepted: number
  rejected: number
  rejections: Record<string, number>
  elapsed_ms: number
  tps: number
  first_tx: string | null
  last_tx: string | null
}

const DevTools: FC = () => {
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [spamCount, setSpamCount] = useState(20)
  const [spamConcurrency, setSpamConcurrency] = useState(4)
  const [spamResult, setSpamResult] = useState<SpamResult | null>(null)

  async function send(kind: string) {
    setBusy(true)
    setStatus(`submitting ${kind}…`)
    setSpamResult(null)
    try {
      const res = await fetch("/api/test-tx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: kind }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus(`error: ${json.error}`)
      } else {
        setStatus(`submitted: ${json.tx_hash}`)
      }
    } catch (err) {
      setStatus(`network error: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function spam() {
    setBusy(true)
    setStatus(`spamming with ${spamCount} txs…`)
    setSpamResult(null)
    try {
      const res = await fetch("/api/spam-tx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "transfer",
          count: spamCount,
          concurrency: spamConcurrency,
        }),
      })
      const json = (await res.json()) as SpamResult | { error: string }
      if (!res.ok) {
        setStatus(`error: ${(json as { error: string }).error}`)
        return
      }
      const r = json as SpamResult
      setSpamResult(r)
      setStatus(
        `spam done: ${r.accepted}/${r.submitted} accepted in ${r.elapsed_ms}ms (${r.tps} tps)`,
      )
    } catch (err) {
      setStatus(`network error: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 justify-center items-center">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => send("transfer")}
          disabled={busy}
          className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Send transfer
        </button>
        <button
          onClick={() => send("opt-in-staking")}
          disabled={busy}
          className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Opt in staking
        </button>
        <button
          onClick={() => send("claim-rewards")}
          disabled={busy}
          className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Claim rewards
        </button>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs opacity-60">Spam:</span>
        <label className="flex items-center gap-1 text-xs">
          count
          <input
            type="number"
            min={1}
            max={500}
            value={spamCount}
            onChange={(e) => setSpamCount(Number(e.target.value) || 1)}
            disabled={busy}
            className="border rounded px-2 py-1 w-20 bg-transparent"
          />
        </label>
        <label className="flex items-center gap-1 text-xs">
          concurrency
          <input
            type="number"
            min={1}
            max={32}
            value={spamConcurrency}
            onChange={(e) => setSpamConcurrency(Number(e.target.value) || 1)}
            disabled={busy}
            className="border rounded px-2 py-1 w-16 bg-transparent"
          />
        </label>
        <button
          onClick={spam}
          disabled={busy}
          className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Spam network
        </button>
      </div>

      {status && (
        <div className="text-xs font-mono opacity-70 break-all">{status}</div>
      )}

      {spamResult && (
        <div className="text-xs font-mono border rounded p-2 flex flex-col gap-1">
          <div>
            submitted: {spamResult.submitted}, accepted: {spamResult.accepted},
            rejected: {spamResult.rejected}
          </div>
          <div>
            elapsed: {spamResult.elapsed_ms}ms, tps:{" "}
            <strong>{spamResult.tps}</strong>
          </div>
          {Object.keys(spamResult.rejections).length > 0 && (
            <div className="opacity-70">
              rejections:{" "}
              {Object.entries(spamResult.rejections)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DevTools