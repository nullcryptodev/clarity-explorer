"use client";

import { FC, useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import type { TxWithLocation } from "@/lib/rpc";
import type { Transaction } from "@/lib/types";
import { formatClrty, shortAddress, shortHash, timeAgo } from "@/lib/format";
import { humanTypeName } from "@/lib/transactionLabels";

type Row = {
  hash: string;
  from: string;
  to: string | null;
  amount: string;
  type: string;
  blockHeight: string | null;
  blockHash: string | null;
  pending: boolean;
  age: string;
};

type Props = {
  limit?: number;
  pollMs?: number;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const TransactionsList: FC<Props> = ({ limit = 50, pollMs = 5000 }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const blockTimesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled && rows.length === 0) setLoading(true);
      if (!cancelled) setError(null);

      try {
        const [pendingResult, confirmedResult] = await Promise.allSettled([
          client.getMempoolList(Math.min(limit, 20)),
          client.getRecentTransactions(limit),
        ]);

        if (cancelled) return;

        const pendingRows: Row[] =
          pendingResult.status === "fulfilled"
            ? pendingResult.value.transactions.map(mempoolEntryToRow)
            : [];

        let confirmedRows: Row[] = [];
        if (confirmedResult.status === "fulfilled") {
          const times = blockTimesRef.current;
          const entries = confirmedResult.value.transactions;

          // Fetch any block timestamps we don't have cached yet.
          const missing: string[] = [];
          const seen = new Set<string>();
          for (const entry of entries) {
            if (!times.has(entry.block_height) && !seen.has(entry.block_height)) {
              missing.push(entry.block_height);
              seen.add(entry.block_height);
            }
          }
          if (missing.length > 0) {
            const fetched = await Promise.all(
              missing.map(async (h) => {
                try {
                  const header = await client.getBlockHeaderByNumber(h);
                  return [h, header.timestamp_ms] as const;
                } catch {
                  return null;
                }
              }),
            );
            if (!cancelled) {
              for (const pair of fetched) {
                if (pair) times.set(pair[0], pair[1]);
              }
            }
          }

          confirmedRows = entries.map((e) =>
            confirmedTxToRow(e, times),
          );
        }

        if (
          pendingResult.status === "rejected" &&
          confirmedResult.status === "rejected"
        ) {
          throw (pendingResult as PromiseRejectedResult).reason;
        }

        setRows([...pendingRows, ...confirmedRows]);
        setConnected(true);
      } catch (err) {
        if (cancelled) return;
        setConnected(false);
        if (err instanceof RpcError) {
          setError(`RPC error: ${err.message}`);
        } else if (err instanceof Error) {
          setError(`Connection error: ${err.message}`);
        } else {
          setError("Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, pollMs]);

  return (
    <div className="border bg-card rounded-xl">
      <div className="p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {rows.length} transaction{rows.length === 1 ? "" : "s"}
        </div>
        <ConnectionDot connected={connected} />
      </div>

      <hr />

      <div className="p-4">
        {error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hash</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Block</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No transactions
                  </TableCell>
                </TableRow>
              )}

              {rows.map((r, idx) => (
                <TableRow key={`${r.hash}-${idx}`}>
                  <TableCell className="font-mono text-xs">
                    {r.pending ? (
                      <span title={`${r.hash} (pending)`}>
                        {shortHash(r.hash, 10, 8)}
                      </span>
                    ) : (
                      <Link
                        href={`/transactions/${r.hash}`}
                        className="hover:underline"
                      >
                        {shortHash(r.hash, 10, 8)}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/address/${r.from}`}
                      className="hover:underline"
                    >
                      {shortAddress(r.from)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.to ? (
                      <Link
                        href={`/address/${r.to}`}
                        className="hover:underline"
                      >
                        {shortAddress(r.to)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.amount} CLRTY
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.pending ? (
                      <span className="text-yellow-600 dark:text-yellow-400">
                        Pending
                      </span>
                    ) : r.blockHeight ? (
                      <Link
                        href={`/blocks/${BigInt(r.blockHeight).toString()}`}
                        className="hover:underline font-mono"
                      >
                        {BigInt(r.blockHeight).toString()}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.age}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

// Data shaping

function mempoolEntryToRow(entry: {
  tx: Transaction;
  fee_rate: string;
  added_ms: string;
  size: string;
  tier: "priority" | "standard";
}): Row {
  return {
    hash: entry.tx.hash,
    from: entry.tx.from,
    to: entry.tx.to,
    amount: formatClrty(entry.tx.amount),
    type: humanTypeName(entry.tx.type),
    blockHeight: null,
    blockHash: null,
    pending: true,
    age: timeAgo(entry.added_ms),
  };
}

function confirmedTxToRow(
  entry: TxWithLocation,
  blockTimes: Map<string, string>,
): Row {
  const timestamp = blockTimes.get(entry.block_height);
  return {
    hash: entry.tx.hash,
    from: entry.tx.from,
    to: entry.tx.to,
    amount: formatClrty(entry.tx.amount),
    type: humanTypeName(entry.tx.type),
    blockHeight: entry.block_height,
    blockHash: entry.block_hash,
    pending: false,
    age: timestamp ? timeAgo(timestamp) : "confirmed",
  };
}

// Small UI helpers

const ConnectionDot: FC<{ connected: boolean | null }> = ({ connected }) => {
  const color =
    connected === null
      ? "bg-yellow-500"
      : connected
        ? "bg-green-500"
        : "bg-red-500";
  const label =
    connected === null ? "Connecting…" : connected ? "Live" : "Offline";
  return (
    <div className="flex items-center gap-2 text-xs opacity-60">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
};

export default TransactionsList;