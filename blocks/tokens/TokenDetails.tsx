"use client";

import { FC, useEffect, useState } from "react";
import Link from "next/link";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import type { HolderEntry, TxWithLocation } from "@/lib/rpc";
import {
  formatClrty,
  formatCount,
  hexToBigInt,
  shortAddress,
  shortHash,
} from "@/lib/format";
import { humanTypeName } from "@/lib/transactionLabels";
import type { TokenInfo } from "@/lib/types";

type Props = {
  tokenId: string;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const TokenDetail: FC<Props> = ({ tokenId }) => {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [supply, setSupply] = useState<string | null>(null);
  const [holders, setHolders] = useState<HolderEntry[] | null>(null);
  const [transfers, setTransfers] = useState<TxWithLocation[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Token ID as a plain decimal string, for use inside URLs. The
  // C++ side accepts both "0x…" and decimal, but formatting here
  // keeps shareable links stable and readable.
  const tokenIdDecimal = (() => {
    try {
      return hexToBigInt(tokenId).toString();
    } catch {
      return tokenId;
    }
  })();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const info = await client.getTokenInfo(tokenId);
        if (cancelled) return;
        setToken(info);

        // The three follow-up queries are independent. Any one
        // failing leaves its card in the "not available" state
        // without taking the whole page down. The token info
        // itself is the only thing whose failure is fatal —
        // without it there's nothing to render.
        const [supplyResult, holdersResult, transfersResult] =
          await Promise.allSettled([
            client.getTokenSupply(tokenId),
            client.getTokenHolders(tokenId, 20),
            client.getTokenTransfers(tokenId, 20),
          ]);

        if (cancelled) return;

        setSupply(
          supplyResult.status === "fulfilled"
            ? supplyResult.value.supply
            : null,
        );

        setHolders(
          holdersResult.status === "fulfilled"
            ? holdersResult.value.holders
            : null,
        );

        setTransfers(
          transfersResult.status === "fulfilled"
            ? transfersResult.value.transfers
            : null,
        );
      } catch (err) {
        if (cancelled) return;

        if (err instanceof RpcError) {
          // -32004 is TokenNotFound in JsonRpcError.h. We don't
          // special-case it because the message is already
          // human-readable, but keeping the check makes the
          // intent obvious if the error-code table ever moves.
          if (err.code === -32004) {
            setError("Token not found");
          } else {
            setError(err.message);
          }
        } else {
          setError("Could not reach the node");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-muted-foreground">Loading token…</div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-destructive">
          {error ?? "Token not found"}
        </div>
      </div>
    );
  }

  const isNative = token.is_native;
  const maxSupplyBig = hexToBigInt(token.max_supply);
  const hasMaxSupply = maxSupplyBig > BigInt(0);
  const supplyBig = supply ? hexToBigInt(supply) : BigInt(0);

  // Minted percentage in basis points. The multiplication happens
  // in bigint space so it can't overflow; the result is bounded by
  // 10,000, so Number() is safe. Zero max_supply = unlimited, in
  // which case the bar isn't drawn.
  const mintedBps = hasMaxSupply
    ? Number((supplyBig * BigInt(10_000)) / maxSupplyBig)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Overview card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">
            {token.name}{" "}
            <span className="text-muted-foreground font-mono text-sm">
              ({token.symbol})
            </span>
          </h2>
          <div className="flex gap-2">
            {isNative && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                Native
              </span>
            )}
            {token.is_bridged && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-mono">
                Bridged
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Token ID">
            <span className="font-mono">
              {formatCount(token.id)}
              {isNative && (
                <span className="text-muted-foreground ml-2 text-xs">
                  (0x0)
                </span>
              )}
            </span>
          </Row>

          <Row label="Symbol">
            <span className="font-mono">{token.symbol}</span>
          </Row>

          <Row label="Name">
            <span>{token.name}</span>
          </Row>

          <Row label="Decimals">
            <span className="font-mono">{token.decimals}</span>
          </Row>

          <Row label="Creator">
            {token.creator ? (
              <Link
                href={`/address/${token.creator}`}
                className="font-mono text-xs hover:underline"
              >
                {shortAddress(token.creator, 12, 8)}
              </Link>
            ) : (
              <span className="text-muted-foreground">
                {isNative ? "— (native token)" : "—"}
              </span>
            )}
          </Row>

          <Row label="Backing">
            <span className="font-mono">{token.backing}</span>
          </Row>

          <Row label="Royalty">
            <span>
              {token.royalty_bps > 0
                ? `${(token.royalty_bps / 100).toFixed(2)}%`
                : "None"}
            </span>
          </Row>

          <Row label="Max supply">
            {hasMaxSupply ? (
              <span className="font-mono">
                {formatClrty(token.max_supply)} {token.symbol}
              </span>
            ) : (
              <span className="text-muted-foreground">Unlimited</span>
            )}
          </Row>

          {token.fingerprint && (
            <Row label="Fingerprint" wide>
              <span className="font-mono text-xs break-all">
                {token.fingerprint}
              </span>
            </Row>
          )}
        </div>
      </div>

      {/* ---- Supply card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-medium mb-4">Supply</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Current supply">
            <span>
              {supply !== null ? (
                <>
                  {formatClrty(supply)} {token.symbol}
                </>
              ) : (
                <span className="text-muted-foreground">Not available</span>
              )}
            </span>
          </Row>

          <Row label="Max supply">
            {hasMaxSupply ? (
              <span>
                {formatClrty(token.max_supply)} {token.symbol}
              </span>
            ) : (
              <span className="text-muted-foreground">Unlimited</span>
            )}
          </Row>

          {hasMaxSupply && supply !== null && (
            <Row label="Minted" wide>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{(mintedBps / 100).toFixed(2)}%</span>
                  <span>
                    {formatClrty(supply)} of{" "}
                    {formatClrty(token.max_supply)} {token.symbol}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, mintedBps / 100)}%`,
                    }}
                  />
                </div>
              </div>
            </Row>
          )}
        </div>
      </div>

      {/* ---- Holders card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Top holders</h3>
          {holders && (
            <span className="text-xs text-muted-foreground font-mono">
              {holders.length} shown
            </span>
          )}
        </div>

        {holders === null ? (
          <p className="text-sm text-muted-foreground">
            Holder data is not available.
          </p>
        ) : holders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holders yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-foreground/5">
            {holders.map((h, idx) => (
              <div
                key={h.address}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-muted-foreground font-mono text-xs w-6 shrink-0">
                    {idx + 1}
                  </span>
                  <Link
                    href={`/address/${h.address}`}
                    className="font-mono text-xs hover:underline truncate"
                  >
                    {shortAddress(h.address, 14, 8)}
                  </Link>
                </div>
                <span className="font-mono text-xs shrink-0 ml-4">
                  {formatClrty(h.balance)} {token.symbol}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Recent transfers card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Recent transfers</h3>
          {transfers && (
            <span className="text-xs text-muted-foreground font-mono">
              {transfers.length} shown
            </span>
          )}
        </div>

        {transfers === null ? (
          <p className="text-sm text-muted-foreground">
            Transfer history is not available.
          </p>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-foreground/5">
            {transfers.map((entry) => {
              const tx = entry.tx;

              // On an address page, "incoming" vs "outgoing" is
              // meaningful because there's a specific address in
              // question. On a token page there isn't — every
              // transfer is shown from the token's point of view.
              // So we render "from → to" without the directional
              // arrow, since both endpoints are equally
              // interesting.
              return (
                <div
                  key={tx.hash}
                  className="flex items-center justify-between py-2 text-sm gap-4"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <Link
                      href={`/transactions/${tx.hash}`}
                      className="font-mono text-xs hover:underline truncate"
                    >
                      {shortHash(tx.hash, 12, 8)}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                      <span>{humanTypeName(tx.type)}</span>
                      {tx.from && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/address/${tx.from}`}
                            className="font-mono hover:underline truncate"
                          >
                            {shortAddress(tx.from, 8, 6)}
                          </Link>
                        </>
                      )}
                      {tx.to && (
                        <>
                          <span>→</span>
                          <Link
                            href={`/address/${tx.to}`}
                            className="font-mono hover:underline truncate"
                          >
                            {shortAddress(tx.to, 8, 6)}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-xs">
                      {formatClrty(tx.amount)} {token.symbol}
                    </span>
                    <Link
                      href={`/blocks/${formatCount(entry.block_height)}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      block #{formatCount(entry.block_height)}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Small helpers

const Row: FC<{
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ label, children, wide }) => (
  <div className={wide ? "md:col-span-2" : undefined}>
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div>{children}</div>
  </div>
);

export default TokenDetail;