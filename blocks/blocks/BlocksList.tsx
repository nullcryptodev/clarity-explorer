"use client";

import { FC, useEffect, useState } from "react";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import type { BlockHeader } from "@/lib/types";
import { formatCount, shortAddress, shortHash, timeAgo } from "@/lib/format";

type Props = {
  pageSize?: number;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const BlocksList: FC<Props> = ({ pageSize = 25 }) => {
  const [blocks, setBlocks] = useState<BlockHeader[]>([]);
  const [tip, setTip] = useState<bigint>(BigInt(0));
  const [start, setStart] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Load the current tip on mount so the first page starts at the
  // newest block. After that, paging is driven by `start`.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const resp = await client.blockNumber();
        if (cancelled) return;
        const height = BigInt(resp.height);
        setTip(height);
        setStart(height);
      } catch (err) {
        if (cancelled) return;
        setConnected(false);
        setError(err instanceof RpcError ? err.message : "Could not reach node");
        setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (start === null) return;

    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const resp = await client.getBlocksRange("0x" + start!.toString(16), pageSize, "desc");
        if (cancelled) return;
        setBlocks(resp.blocks);
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
    return () => {
      cancelled = true;
    };
  }, [start, pageSize]);

  const canPrev = start !== null && start < tip;
  const canNext = start !== null && start > BigInt(0);

  function goPrev() {
    if (start === null) return;
    // Paging moves the window by pageSize. The `start` is the
    // highest height in the current page; prev adds pageSize
    // (clamped at tip).
    const next = start + BigInt(pageSize);
    setStart(next > tip ? tip : next);
  }

  function goNext() {
    if (start === null) return;
    const next = start - BigInt(pageSize);
    setStart(next < BigInt(0) ? BigInt(0) : next);
  }

  return (
    <div className="border bg-card rounded-xl">
      <div className="p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {start !== null && (
            <>
              Showing blocks{" "}
              <span className="font-mono">
                {formatCount(
                  "0x" +
                  (start < BigInt(pageSize)
                    ? BigInt(0)
                    : start - BigInt(pageSize - 1)
                  ).toString(16),
                )}
              </span>
              {start >= BigInt(0) && (
                <>
                  {" "}
                  through{" "}
                  <span className="font-mono">{formatCount("0x" + start.toString(16))}</span>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionDot connected={connected} />
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={!canPrev || loading}
          >
            Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!canNext || loading}
          >
            Older
          </Button>
        </div>
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
                <TableHead>Height</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Producer</TableHead>
                <TableHead className="text-right">TXs</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {blocks.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No blocks
                  </TableCell>
                </TableRow>
              )}

              {blocks.map((b) => (
                <TableRow key={b.hash}>
                  <TableCell>
                    <Link
                      href={`/blocks/${BigInt(b.height).toString()}`}
                      className="font-medium hover:underline"
                    >
                      {formatCount(b.height)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/blocks/${BigInt(b.height).toString()}`}
                      className="hover:underline"
                    >
                      {shortHash(b.hash, 10, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/address/${b.proposer}`}
                      className="hover:underline"
                    >
                      {shortAddress(b.proposer)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {b.tx_count}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCount(b.total_fees)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {timeAgo(b.timestamp_ms)}
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

export default BlocksList;