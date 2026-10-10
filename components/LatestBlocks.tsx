"use client"

import { FC, useEffect, useRef, useState } from "react"
import { Blocks } from "lucide-react"
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
import type { BlockHeader } from "@/lib/types"
import {
  bigIntToHex,
  formatClrty,
  formatCount,
  hexToBigInt,
  shortAddress,
  timeAgo,
} from "@/lib/format"
import { REWARD_SPLIT } from "@/lib/rewards"
import { RewardBar } from "./RewardBar"

type BlockRow = {
  heightHex: string
  heightNumber: string
  blockHash: string

  blockHeight: string
  timeAgo: string
  producerAddress: string
  producerFull: string
  totalTransactions: string
  blockReward: string
  validatorShare: string
  stakerShare: string
  potShare: string
  /** Whether the split shown is the seed-only variant. */
  seedOnly: boolean
}

type Props = {
  limit?: number
  pollMs?: number
}

const client = new RpcClient({ url: DEFAULT_RPC_URL })

const LatestBlocks: FC<Props> = ({ limit = 10, pollMs = 5000 }) => {
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // null  = never fetched yet (initial state)
  // true  = last fetch succeeded
  // false = last fetch failed
  //
  // The initial null is what keeps the badge from flashing
  // "Offline" before the first request completes.
  const [connected, setConnected] = useState<boolean | null>(null)

  // Cached per-height. Kept in a ref so re-renders don't clobber
  // it, and so the fetch loop can see timestamps it pulled on a
  // previous tick.
  const blockTimesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function fetchSeedOnly(): Promise<boolean> {
      try {
        const activeSet = await client.getActiveSet()
        if (activeSet.ids.length === 0) return false

        // getValidators(activeOnly=true) returns the records for
        // the current active set, each carrying an is_seed flag.
        const resp = await client.getValidators(true)
        if (resp.validators.length === 0) return false

        return resp.validators.every((v) => v.is_seed)
      } catch {
        // If either lookup fails, fall back to "not seed-only,"
        // which renders the nominal split. Wrong label is better
        // than failing the whole table.
        return false
      }
    }

    async function load() {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }

      try {
        // The two fetches are independent, and both are needed
        // before any row can be built. Running them in parallel
        // halves the wall-clock latency of a poll, and — more
        // importantly — lets us use the freshly-returned
        // isSeedOnly directly in headerToRow, rather than reading
        // it back out of React state (which would be stale on the
        // first tick and require an extra render to fix).
        const [recent, isSeedOnly] = await Promise.all([
          client.getRecentBlocks(limit),
          fetchSeedOnly(),
        ])

        if (cancelled) return

        const times = blockTimesRef.current
        for (const h of recent.blocks) {
          times.set(h.height, h.timestamp_ms)
        }

        setBlocks(recent.blocks.map((h) => headerToRow(h, isSeedOnly)))
        setConnected(true)
      } catch (err) {
        if (cancelled) return

        setConnected(false)
        if (err instanceof RpcError) {
          setError(`RPC error: ${err.message}`)
        } else if (err instanceof Error) {
          setError(`Connection error: ${err.message}`)
        } else {
          setError("Unknown error")
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
          <Blocks className="text-primary" />
          <h1 className="font-medium">Latest Blocks</h1>
        </div>
        <ConnectionDot connected={connected} />
      </div>

      <hr />

      <div className="p-4">
        {error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : loading && blocks.length === 0 ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>Producer</TableHead>
                <TableHead className="text-right">TXs</TableHead>
                <TableHead className="text-right">Block Reward</TableHead>
                <TableHead className="text-center">Reward Split</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {blocks.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No blocks yet
                  </TableCell>
                </TableRow>
              )}

              {blocks.map((item) => (
                <TableRow key={item.heightHex}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/blocks/${item.heightNumber}`}
                        className="text-left font-medium hover:underline"
                      >
                        {item.blockHeight}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {item.timeAgo}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-xs">
                    <Tooltip>
                      <TooltipTrigger className="cursor-default">
                        <Link
                          href={`/address/${item.producerFull}`}
                          className="hover:underline"
                        >
                          {item.producerAddress}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{item.producerFull}</TooltipContent>
                    </Tooltip>
                  </TableCell>

                  <TableCell className="text-right">
                    {item.totalTransactions}
                  </TableCell>

                  <TableCell className="text-right">
                    {item.blockReward} CLRTY
                  </TableCell>

                  <TableCell className="text-right">
                    <RewardBar
                      validatorShare={item.validatorShare}
                      stakerShare={item.stakerShare}
                      potShare={item.potShare}
                      seedOnly={item.seedOnly}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <hr />

      <Link href="/blocks">
        <div className="p-4 flex justify-center opacity-50 hover:opacity-100 duration-300 hover:dark:bg-white/5">
          View all Blocks
        </div>
      </Link>
    </div>
  )
}

// Data shaping

function headerToRow(header: BlockHeader, seedOnly: boolean): BlockRow {
  const total = bigIntToHex(REWARD_SPLIT.total)

  // The producer bonus and set share are the same number in both
  // the nominal and seed-only cases — only the destination of the
  // set share changes (validators vs. pot). So the "validator"
  // segment is always producerBonus, and the other two segments
  // swap depending on whether we're in seed-only mode.
  const producer = bigIntToHex(REWARD_SPLIT.producerBonus)
  const staker = bigIntToHex(REWARD_SPLIT.stakerPool)

  // Seed-only: set share routes to the pot, so the pot segment is
  // stakerPool + setShare. Non-seed-only: stakerPool stays with
  // stakers, setShare goes to validators as part of their share.
  const pot = seedOnly
    ? bigIntToHex(REWARD_SPLIT.stakerPool + REWARD_SPLIT.setShare)
    : bigIntToHex(REWARD_SPLIT.setShare)

  // In seed-only mode there are no stakers yet (the chain is too
  // young for anyone to have opted in), so the staker segment is
  // zero. In normal mode, stakerPool goes to stakers.
  const stakerSegment = seedOnly ? "0" : formatClrty(staker)

  return {
    heightHex: header.height,
    heightNumber: hexToBigInt(header.height).toString(),
    blockHash: header.hash,

    blockHeight: formatCount(header.height),
    timeAgo: timeAgo(header.timestamp_ms),
    producerAddress: shortAddress(header.proposer),
    producerFull: header.proposer,
    totalTransactions: header.tx_count.toString(),
    blockReward: formatClrty(total),
    validatorShare: formatClrty(producer),
    stakerShare: stakerSegment,
    potShare: formatClrty(pot),
    seedOnly,
  }
}

// Small UI helpers

const ConnectionDot: FC<{ connected: boolean | null }> = ({ connected }) => {
  const color =
    connected === null
      ? "bg-yellow-500"
      : connected
        ? "bg-green-500"
        : "bg-red-500"
  const label =
    connected === null ? "Connecting…" : connected ? "Live" : "Offline"
  return (
    <div className="flex items-center gap-2 text-xs opacity-60">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  )
}

export default LatestBlocks