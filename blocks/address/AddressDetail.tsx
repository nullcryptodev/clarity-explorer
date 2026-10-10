"use client";

import { FC, useEffect, useState } from "react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import type { TxWithLocation, TokenBalancePair } from "@/lib/rpc";
import {
  bigIntToHex,
  formatClrty,
  formatCount,
  hexToBigInt,
  shortAddress,
  shortHash,
} from "@/lib/format";
import { humanTypeName } from "@/lib/transactionLabels";
import type { Account, AmmPosition, Order, Validator } from "@/lib/types";

type Props = {
  address: string;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const AddressDetail: FC<Props> = ({ address }) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [tokens, setTokens] = useState<TokenBalancePair[] | null>(null);
  const [positions, setPositions] = useState<AmmPosition[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [transactions, setTransactions] = useState<TxWithLocation[] | null>(
    null,
  );
  const [validator, setValidator] = useState<Validator | null>(null);
  const [validatorChecked, setValidatorChecked] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setValidatorChecked(false);

      try {
        const acct = await client.getAccount(address);
        if (cancelled) return;
        setAccount(acct);

        // Validator lookup. Any failure means "this address is
        // not a registered validator" — we don't try to
        // distinguish "not found" from "lookup failed" because
        // the address page can't do anything different in either
        // case. The validator card is a bonus; its absence is
        // normal.
        client
          .getValidatorByAddress(address)
          .then((v) => {
            if (!cancelled) {
              setValidator(v);
              setValidatorChecked(true);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setValidator(null);
              setValidatorChecked(true);
            }
          });

        const [tokensResult, positionsResult, ordersResult, txsResult] =
          await Promise.allSettled([
            client.getTokensForAddress(address),
            client.getPositionsForAddress(address),
            client.getOrdersForAddress(address),
            client.getTransactionsForAddress(address, 20),
          ]);

        if (cancelled) return;

        setTokens(
          tokensResult.status === "fulfilled"
            ? tokensResult.value.tokens
            : null,
        );
        setPositions(
          positionsResult.status === "fulfilled"
            ? positionsResult.value.positions
            : null,
        );
        setOrders(
          ordersResult.status === "fulfilled"
            ? ordersResult.value.orders
            : null,
        );
        setTransactions(
          txsResult.status === "fulfilled"
            ? txsResult.value.transactions
            : null,
        );
      } catch (err) {
        if (cancelled) return;

        if (err instanceof RpcError) {
          setError(err.message);
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
  }, [address]);

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-muted-foreground">Loading address…</div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-destructive">
          {error ?? "Address not found"}
        </div>
      </div>
    );
  }

  // Empty = no balance, no rewards, no stake, no nonce, and not
  // opted out. Nonce is part of the check because an account that
  // has sent transactions but currently holds nothing is not
  // "empty" — it has history.
  const isEmpty =
    account.balance === "0x0" &&
    account.pending_rewards === "0x0" &&
    account.staked === "0x0" &&
    account.nonce === "0x0" &&
    !account.staking_opted_out;

  // Compute total_value client-side rather than trusting the
  // server's derived field. If the server emits it, this is
  // identical; if it doesn't, this still works.
  const totalValueHex = bigIntToHex(
    hexToBigInt(account.balance) + hexToBigInt(account.pending_rewards),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Overview card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Overview</h2>
          <div className="flex gap-2">
            {!isEmpty && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-mono">
                Active
              </span>
            )}
            {isEmpty && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground font-mono">
                Empty
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Balance">
            <span>{formatClrty(account.balance)} CLRTY</span>
          </Row>

          <Row label="Total value">
            <Tooltip>
              <TooltipTrigger className="cursor-default">
                <span>{formatClrty(totalValueHex)} CLRTY</span>
              </TooltipTrigger>
              <TooltipContent>Balance + pending rewards</TooltipContent>
            </Tooltip>
          </Row>

          <Row label="Nonce">
            <span className="font-mono">{formatCount(account.nonce)}</span>
          </Row>

          <Row label="Created at">
            {hexToBigInt(account.created_at_height) === BigInt(0) && isEmpty ? (
              <span className="text-muted-foreground">Never touched</span>
            ) : (
              <Link
                href={`/blocks/${hexToBigInt(account.created_at_height)}`}
                className="hover:underline"
              >
                Block #{formatCount(account.created_at_height)}
              </Link>
            )}
          </Row>
        </div>
      </div>

      {/* ---- Staking card ---- */}
      {!isEmpty && (
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-medium mb-4">Staking</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Row label="Staked">
              <span>{formatClrty(account.staked)} CLRTY</span>
            </Row>

            <Row label="Pending rewards">
              <span>{formatClrty(account.pending_rewards)} CLRTY</span>
            </Row>

            <Row label="Status">
              {account.staking_opted_out ? (
                <span className="text-yellow-600 dark:text-yellow-400">
                  Opted out
                </span>
              ) : hexToBigInt(account.staked) > BigInt(0) ? (
                <span className="text-green-600 dark:text-green-400">
                  Earning
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Below auto-stake threshold
                </span>
              )}
            </Row>

            <Row label="Staker since">
              {hexToBigInt(account.staker_since_height) === BigInt(0) ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Link
                  href={`/blocks/${hexToBigInt(account.staker_since_height)}`}
                  className="hover:underline"
                >
                  Block #{formatCount(account.staker_since_height)}
                </Link>
              )}
            </Row>

            <Row label="Last reward epoch">
              <span className="font-mono">
                {formatCount(account.last_reward_epoch)}
              </span>
            </Row>
          </div>
        </div>
      )}

      {/* ---- Validator card (only when registered) ---- */}
      {validatorChecked && validator && (
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Validator</h3>
            <div className="flex gap-2">
              {validator.is_seed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                  Seed
                </span>
              )}
              {validator.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-mono">
                  Active
                </span>
              )}
              {validator.is_offline && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-mono">
                  Offline
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Row label="Validator ID">
              <span className="font-mono">{formatCount(validator.id)}</span>
            </Row>

            <Row label="Stake">
              <span>{formatClrty(validator.stake)} CLRTY</span>
            </Row>

            <Row label="Reward address" wide>
              <span className="font-mono text-xs break-all">
                {validator.reward_address}
              </span>
            </Row>

            <Row label="Registered at">
              <Link
                href={`/blocks/${hexToBigInt(validator.registered_at_height)}`}
                className="hover:underline"
              >
                Block #{formatCount(validator.registered_at_height)}
              </Link>
            </Row>

            <Row label="Blocks produced">
              <span className="font-mono">
                {formatCount(validator.total_blocks_produced)}
              </span>
            </Row>

            <Row label="Total rewards earned">
              <span>{formatClrty(validator.total_rewards_earned)} CLRTY</span>
            </Row>

            <Row label="Epochs active">
              <span className="font-mono">
                {formatCount(validator.epochs_active)}
              </span>
            </Row>

            <Row label="Uptime">
              <span className="font-mono">
                {(validator.uptime_score / 100).toFixed(2)}%
              </span>
            </Row>

            <Row label="Reward multiplier">
              <span className="font-mono">
                {(validator.reward_multiplier / 100).toFixed(2)}%
              </span>
            </Row>

            {validator.infraction_count > 0 && (
              <>
                <Row label="Infractions">
                  <span className="text-destructive font-mono">
                    {validator.infraction_count}
                  </span>
                </Row>
                <Row label="Last infraction">
                  <Link
                    href={`/blocks/${hexToBigInt(validator.last_infraction_height)}`}
                    className="hover:underline"
                  >
                    Block #{formatCount(validator.last_infraction_height)}
                  </Link>
                </Row>
              </>
            )}

            <Row label="Consensus key" wide>
              <span className="font-mono text-xs break-all">
                {validator.consensus_key}
              </span>
            </Row>
          </div>
        </div>
      )}

      {/* ---- Tokens card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Tokens</h3>
          {tokens && (
            <span className="text-xs text-muted-foreground font-mono">
              {tokens.length} held
            </span>
          )}
        </div>

        {tokens === null ? (
          <p className="text-sm text-muted-foreground">
            Token holdings are not available.
          </p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens held.</p>
        ) : (
          <div className="flex flex-col divide-y divide-foreground/5">
            {tokens.map((t) => (
              <div
                key={t.token_id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <Link
                  href={`/tokens/${t.token_id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {t.token_id === "0x0"
                    ? "CLRTY (native)"
                    : `Token ${formatCount(t.token_id)}`}
                </Link>
                <span className="font-mono text-xs">
                  {formatClrty(t.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- LP positions card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Liquidity positions</h3>
          {positions && (
            <span className="text-xs text-muted-foreground font-mono">
              {positions.length} open
            </span>
          )}
        </div>

        {positions === null ? (
          <p className="text-sm text-muted-foreground">
            Position data is not available.
          </p>
        ) : positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open liquidity positions.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-foreground/5">
            {positions.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-mono text-xs">
                  Pool {formatCount(p.pool_id)}
                </span>
                <span className="font-mono text-xs">
                  {formatClrty(p.liquidity)} LP
                  {p.share_bps !== undefined && (
                    <span className="text-muted-foreground ml-2">
                      ({(p.share_bps / 100).toFixed(2)}% share)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Open orders card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Open orders</h3>
          {orders && (
            <span className="text-xs text-muted-foreground font-mono">
              {orders.length} open
            </span>
          )}
        </div>

        {orders === null ? (
          <p className="text-sm text-muted-foreground">
            Order data is not available.
          </p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open orders.</p>
        ) : (
          <div className="flex flex-col divide-y divide-foreground/5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs">
                    Order {formatCount(o.id)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatClrty(o.sell_amount)} → {formatClrty(o.min_buy_amount)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{o.mode}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Transactions card ---- */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Recent transactions</h3>
          {transactions && (
            <span className="text-xs text-muted-foreground font-mono">
              {transactions.length} shown
            </span>
          )}
        </div>

        {transactions === null ? (
          <p className="text-sm text-muted-foreground">
            Transaction history is not available.
          </p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-foreground/5">
            {transactions.map((entry) => {
              const tx = entry.tx;
              const isOutgoing = tx.from === address;
              const counterparty = isOutgoing ? tx.to : tx.from;

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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={
                          isOutgoing
                            ? "text-destructive"
                            : "text-green-600 dark:text-green-400"
                        }
                      >
                        {isOutgoing ? "→" : "←"}
                      </span>
                      <span>{humanTypeName(tx.type)}</span>
                      {counterparty && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/address/${counterparty}`}
                            className="font-mono hover:underline"
                          >
                            {shortAddress(counterparty, 8, 6)}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-xs">
                      {formatClrty(tx.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      block #{formatCount(entry.block_height)}
                    </span>
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

export default AddressDetail;