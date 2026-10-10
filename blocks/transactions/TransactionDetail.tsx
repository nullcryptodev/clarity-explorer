"use client";

import { FC, useEffect, useState } from "react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import type { Receipt, Transaction, TransactionWithLocation } from "@/lib/types";
import {
  formatClrty,
  formatCount,
  hexToBigInt,
  shortAddress,
  shortHash,
  timeAgo,
} from "@/lib/format";

type Props = {
  hash: string;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

// Human-readable labels for the transaction type enum on the wire.
// The C++ side emits lowercased snake_case names; this maps them to
// something a person wants to read. Unknown types pass through
// unchanged so a future type doesn't break the UI.
const TYPE_LABELS: Record<string, string> = {
  transfer: "Transfer",
  opt_in_staking: "Stake",
  opt_out_staking: "Unstake",
  claim_rewards: "Claim Rewards",
  register_validator: "Register Validator",
  unregister_validator: "Unregister Validator",
  update_reward_address: "Update Reward Address",
  create_pool: "Create Pool",
  add_liquidity: "Add Liquidity",
  remove_liquidity: "Remove Liquidity",
  swap: "Swap",
  create_order: "Create Order",
  cancel_order: "Cancel Order",
  create_token: "Create Token",
  mint_token: "Mint Token",
  burn_token: "Burn Token",
  update_token_meta: "Update Token Metadata",
  block_reward: "Block Reward",
  order_expired: "Order Expired",
  slash: "Slash",
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t;
}

const TransactionDetail: FC<Props> = ({ hash }) => {
  const [txWithLocation, setTxWithLocation] =
    useState<TransactionWithLocation | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptMissing, setReceiptMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setReceiptMissing(false);

      try {
        const result = await client.getTransactionByHash(hash);
        if (cancelled) return;
        setTxWithLocation(result);

        // If the tx is confirmed, try to fetch the receipt. If the
        // receipt is missing (which shouldn't happen for a confirmed
        // tx but is a real error path), record that separately so
        // the UI can show "receipt unavailable" rather than failing
        // the whole page.
        if (result.status === "confirmed") {
          try {
            const r = await client.getTransactionReceipt(hash);
            if (!cancelled) setReceipt(r);
          } catch (err) {
            if (cancelled) return;
            if (err instanceof RpcError) {
              setReceiptMissing(true);
            } else {
              setReceiptMissing(true);
            }
          }
        }
      } catch (err) {
        if (cancelled) return;

        if (err instanceof RpcError) {
          if (err.code === -32002) {
            // TransactionNotFound
            setError("Transaction not found");
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
  }, [hash]);

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-muted-foreground">
          Loading transaction…
        </div>
      </div>
    );
  }

  if (error || !txWithLocation) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-destructive">
          {error ?? "Transaction not found"}
        </div>
      </div>
    );
  }

  const { tx, status, block_hash, block_height, index } = txWithLocation;
  const isPending = status === "pending";

  return (
    <div className="flex flex-col gap-4">
      {/* Status card */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">
            {typeLabel(tx.type)}
          </h2>
          <StatusBadge pending={isPending} receipt={receipt} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {/* Hash (wide) */}
          <Row label="Transaction hash" wide>
            <span className="font-mono text-xs break-all">{tx.hash}</span>
          </Row>

          {/* Type (with numeric code) */}
          <Row label="Type">
            <span>{typeLabel(tx.type)}</span>
            <span className="text-muted-foreground ml-2 text-xs font-mono">
              (0x{tx.type_code.toString(16)})
            </span>
          </Row>

          {/* Status detail */}
          <Row label="Status">
            {isPending ? (
              <span className="text-yellow-600 dark:text-yellow-400">
                Pending — in mempool
              </span>
            ) : (
              <span className="text-green-600 dark:text-green-400">
                Confirmed
              </span>
            )}
          </Row>

          {/* Block + position (only if confirmed) */}
          {!isPending && block_height && block_hash && (
            <>
              <Row label="Block">
                <Link
                  href={`/blocks/${hexToBigInt(block_height)}`}
                  className="hover:underline"
                >
                  #{formatCount(block_height)}
                </Link>
                <span className="text-muted-foreground ml-2 text-xs">
                  (index {index})
                </span>
              </Row>

              <Row label="Block hash" wide>
                <span className="font-mono text-xs break-all">
                  {block_hash}
                </span>
              </Row>
            </>
          )}

          {/* From */}
          <Row label="From">
            <Link
              href={`/address/${tx.from}`}
              className="font-mono text-xs hover:underline"
            >
              {shortAddress(tx.from, 12, 8)}
            </Link>
          </Row>

          {/* To (may be null) */}
          <Row label="To">
            {tx.to ? (
              <Link
                href={`/address/${tx.to}`}
                className="font-mono text-xs hover:underline"
              >
                {shortAddress(tx.to, 12, 8)}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Row>

          {/* Amount */}
          <Row label="Amount">
            <span>
              {formatClrty(tx.amount)}{" "}
              {tx.token_id === "0x0" ? "CLRTY" : `token ${tx.token_id}`}
            </span>
          </Row>

          {/* Fee */}
          <Row label="Fee">
            <span>{formatClrty(tx.fee)} CLRTY</span>
          </Row>

          {/* Fee paid (from receipt) */}
          {receipt && (
            <Row label="Fee paid">
              <span>{formatClrty(receipt.fee_paid)} CLRTY</span>
            </Row>
          )}

          {/* Nonce */}
          <Row label="Nonce">
            <span className="font-mono">{formatCount(tx.nonce)}</span>
          </Row>

          {/* Valid until */}
          <Row label="Valid until">
            {hexToBigInt(tx.valid_until_height) === BigInt(0) ? (
              <span className="text-muted-foreground">No expiry</span>
            ) : (
              <Link
                href={`/blocks/${hexToBigInt(tx.valid_until_height)}`}
                className="hover:underline"
              >
                Block #{formatCount(tx.valid_until_height)}
              </Link>
            )}
          </Row>

          {/* Token ID */}
          <Row label="Token ID">
            <span className="font-mono">
              {tx.token_id === "0x0" ? "0x0 (native)" : tx.token_id}
            </span>
          </Row>

          {/* Chain ID */}
          <Row label="Chain ID">
            <span className="font-mono">{tx.chain_id}</span>
          </Row>

          {/* Version */}
          <Row label="Version">
            <span className="font-mono">{tx.version}</span>
          </Row>
        </div>
      </div>

      {/* Receipt card (only for confirmed txs) */}
      {!isPending && (
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-medium mb-4">Receipt</h3>

          {receiptMissing ? (
            <p className="text-sm text-muted-foreground">
              Receipt not available for this transaction.
            </p>
          ) : receipt ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Status">
                <span
                  className={
                    receipt.status === "success"
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  }
                >
                  {receipt.status === "success" ? "Success" : "Failure"}
                </span>
              </Row>

              <Row label="Fee paid">
                <span>{formatClrty(receipt.fee_paid)} CLRTY</span>
              </Row>

              <Row label="Block">
                <Link
                  href={`/blocks/${hexToBigInt(receipt.block_height)}`}
                  className="hover:underline"
                >
                  #{formatCount(receipt.block_height)}
                </Link>
              </Row>

              <Row label="Index in block">
                <span className="font-mono">{receipt.index}</span>
              </Row>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Loading receipt…
            </p>
          )}
        </div>
      )}

      {/* Payload card (if present) */}
      {tx.payload && tx.payload !== "0x" && (
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Payload</h3>
            <span className="text-xs text-muted-foreground font-mono">
              {tx.payload_size} bytes
            </span>
          </div>
          <pre className="text-xs font-mono break-all whitespace-pre-wrap bg-muted/30 p-3 rounded">
            {tx.payload}
          </pre>
        </div>
      )}
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

const StatusBadge: FC<{
  pending: boolean;
  receipt: Receipt | null;
}> = ({ pending, receipt }) => {
  if (pending) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-mono">
        Pending
      </span>
    );
  }
  if (receipt?.status === "failure") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-mono">
        Failed
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-mono">
      Confirmed
    </span>
  );
};

export default TransactionDetail;