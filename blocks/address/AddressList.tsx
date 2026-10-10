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
import type { AddressListEntry } from "@/lib/rpc";
import { formatClrty, formatCount, shortAddress } from "@/lib/format";

type Props = {
  pageSize?: number;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const AddressesList: FC<Props> = ({ pageSize = 50 }) => {
  const [entries, setEntries] = useState<AddressListEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled && entries.length === 0) setLoading(true);
      if (!cancelled) setError(null);

      try {
        const resp = await client.getAddressList(pageSize, offset);
        if (cancelled) return;
        setEntries(resp.addresses);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, pageSize]);

  const canPrev = offset > 0;

  return (
    <div className="border bg-card rounded-xl">
      <div className="p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {entries.length > 0 && (
            <>
              Showing {offset + 1}–{offset + entries.length}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionDot connected={connected} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
            disabled={!canPrev || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(offset + pageSize)}
            disabled={entries.length < pageSize || loading}
          >
            Next
          </Button>
        </div>
      </div>

      <hr />

      <div className="p-4">
        {error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : loading && entries.length === 0 ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Nonce</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground py-8"
                  >
                    No addresses
                  </TableCell>
                </TableRow>
              )}

              {entries.map((e) => (
                <TableRow key={e.address}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/address/${e.address}`}
                      className="hover:underline"
                    >
                      {shortAddress(e.address, 14, 10)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatClrty(e.balance)} CLRTY
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCount(e.nonce)}
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

export default AddressesList;