"use client"

import { FC, useEffect, useRef, useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc"
import type { TxWithLocation } from "@/lib/rpc"
import type { Transaction } from "@/lib/types"
import {
  formatClrty,
  shortAddress,
  shortHash,
  timeAgo,
} from "@/lib/format"
import { humanTypeName } from "@/lib/transactionLabels"

type TransactionRow = {
  txHash: string
  transactionHash: string
  timeAgo: string
  fromAddress: string
  fromFull: string
  toAddress: string
  toFull: string
  amount: string
  transactionType: string
  pending: boolean
  // Only set for pending rows.
  tier?: "priority" | "standard"
}

type Props = {
  limit?: number
  pollMs?: number
}

const client = new RpcClient({ url: DEFAULT_RPC_URL })

const LatestTransactions: FC<Props> = ({ limit = 10, pollMs = 5000 }) => {
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const blockTimesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadTransactions(): Promise<TransactionRow[]> {
      // Cap pending rows so a mempool flood doesn't push confirmed
      // activity off the visible page.
      const pendingLimit = Math.min(limit, 5)

      const [confirmedResult, pendingResult] = await Promise.allSettled([
        client.getRecentTransactions(limit),
        client.getMempoolList(pendingLimit),
      ])

      // Pending rows first. If the mempool fetch fails, fall back to
      // nothing rather than failing the whole table.
      const pendingRows: TransactionRow[] =
        pendingResult.status === "fulfilled"
          ? pendingResult.value.transactions.map(mempoolEntryToRow)
          : []

      // Confirmed rows second. If the RPC fails, the table shows
      // only pending rows (or nothing) rather than a hard error.
      let confirmedRows: TransactionRow[] = []

      if (confirmedResult.status === "fulfilled") {
        const times = blockTimesRef.current
        const entries = confirmedResult.value.transactions

        // Ensure every referenced block has a cached timestamp.
        const missing: string[] = []
        const seen = new Set<string>()
        for (const entry of entries) {
          if (
            !times.has(entry.block_height) &&
            !seen.has(entry.block_height)
          ) {
            missing.push(entry.block_height)
            seen.add(entry.block_height)
          }
        }

        if (missing.length > 0) {
          const fetched = await Promise.all(
            missing.map(async (height) => {
              try {
                const header = await client.getBlockHeaderByNumber(height)
                return [height, header.timestamp_ms] as const
              } catch {
                return null
              }
            }),
          )
          if (!cancelled) {
            for (const pair of fetched) {
              if (pair) times.set(pair[0], pair[1])
            }
          }
        }

        confirmedRows = entries.map((entry) =>
          txWithLocationToRow(entry, times),
        )
      }

      return [...pendingRows, ...confirmedRows]
    }

    async function load() {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }

      try {
        const rows = await loadTransactions()
        if (!cancelled) {
          setTransactions(rows)
          setConnected(true)
        }
      } catch (err) {
        if (cancelled) return

        if (err instanceof RpcError) {
          setError(`RPC error: ${err.message}`)
          setConnected(true)
        } else {
          setError(null)
          setConnected(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, pollMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [limit, pollMs])

  return (
    <div className="border bg-card rounded-xl">
      <div className="p-4 flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <ArrowLeftRight className="text-primary" />
          <h1 className="font-medium">Latest Transactions</h1>
        </div>
        <ConnectionDot connected={connected} />
      </div>

      <hr />

      <div className="p-4">
        {loading && transactions.length === 0 && (
          <div className="text-muted-foreground text-sm">Loading…</div>
        )}

        {error && <div className="text-destructive text-sm">{error}</div>}

        {!error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-center">Amount</TableHead>
                <TableHead className="text-right">Type</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {transactions.length === 0 && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No transactions yet
                  </TableCell>
                </TableRow>
              )}

              {transactions.map((item, idx) => (
                <TableRow key={`${item.txHash}-${idx}`}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.pending ? (
                        <Tooltip>
                          <TooltipTrigger className="cursor-default text-left font-medium font-mono text-xs">
                            {item.transactionHash}
                          </TooltipTrigger>
                          <TooltipContent>
                            {item.txHash} (pending)
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Link
                          href={`/transactions/${item.txHash}`}
                          className="text-left font-medium hover:underline"
                        >
                          {item.transactionHash}
                        </Link>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.timeAgo}</span>
                        {item.pending && (
                          <PendingBadge tier={item.tier} />
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-xs">
                    <Tooltip>
                      <TooltipTrigger className="cursor-default">
                        <Link
                          href={`/address/${item.fromFull}`}
                          className="hover:underline"
                        >
                          {item.fromAddress}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{item.fromFull}</TooltipContent>
                    </Tooltip>
                  </TableCell>

                  <TableCell className="font-mono text-xs">
                    {item.toFull ? (
                      <Tooltip>
                        <TooltipTrigger className="cursor-default">
                          <Link
                            href={`/address/${item.toFull}`}
                            className="hover:underline"
                          >
                            {item.toAddress}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>{item.toFull}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">{item.amount}</TableCell>

                  <TableCell className="text-right">
                    {item.transactionType}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <hr />

      <Link href="/transactions">
        <div className="p-4 flex justify-center opacity-50 hover:opacity-100 duration-300 hover:dark:bg-white/5">
          View all Transactions
        </div>
      </Link>
    </div>
  )
}

// Data shaping

function mempoolEntryToRow(
  entry: {
    tx: Transaction
    fee_rate: string
    added_ms: string
    size: string
    tier: "priority" | "standard"
  },
): TransactionRow {
  return {
    txHash: entry.tx.hash,
    transactionHash: shortHash(entry.tx.hash),
    timeAgo: timeAgo(entry.added_ms),
    fromAddress: shortAddress(entry.tx.from),
    fromFull: entry.tx.from,
    toAddress: entry.tx.to ? shortAddress(entry.tx.to) : "—",
    toFull: entry.tx.to ?? "",
    amount: `${formatClrty(entry.tx.amount)} CLRTY`,
    transactionType: humanTypeName(entry.tx.type),
    pending: true,
    tier: entry.tier,
  }
}

function txWithLocationToRow(
  entry: TxWithLocation,
  blockTimes: Map<string, string>,
): TransactionRow {
  const timestamp = blockTimes.get(entry.block_height)
  return {
    txHash: entry.tx.hash,
    transactionHash: shortHash(entry.tx.hash),
    timeAgo: timestamp ? timeAgo(timestamp) : "confirmed",
    fromAddress: shortAddress(entry.tx.from),
    fromFull: entry.tx.from,
    toAddress: entry.tx.to ? shortAddress(entry.tx.to) : "—",
    toFull: entry.tx.to ?? "",
    amount: `${formatClrty(entry.tx.amount)} CLRTY`,
    transactionType: humanTypeName(entry.tx.type),
    pending: false,
  }
}

// Small UI helpers

const PendingBadge: FC<{ tier?: "priority" | "standard" }> = ({ tier }) => {
  const label = tier === "priority" ? "Priority" : "Pending"
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
      {label}
    </span>
  )
}

const ConnectionDot: FC<{ connected: boolean }> = ({ connected }) => {
  const color = connected ? "bg-green-500" : "bg-red-500"
  const label = connected ? "Live" : "Offline"
  return (
    <div className="flex items-center gap-2 text-xs opacity-60">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  )
}

export default LatestTransactions