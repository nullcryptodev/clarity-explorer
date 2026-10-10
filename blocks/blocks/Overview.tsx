"use client";

import { FC, useEffect, useState } from "react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RewardBar } from "@/components/RewardBar";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import type { Block } from "@/lib/types";
import {
  bigIntToHex,
  formatClrty,
  formatCount,
  hexToBigInt,
  shortAddress,
  timeAgo,
} from "@/lib/format";
import { REWARD_SPLIT } from "@/lib/rewards";

type Props = {
  height: string;
};

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const Overview: FC<Props> = ({ height }) => {
  const [block, setBlock] = useState<Block | null>(null);
  const [seedOnly, setSeedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSeedOnly(): Promise<boolean> {
      try {
        const resp = await client.getValidators(true);
        if (resp.validators.length === 0) return false;
        return resp.validators.every((v) => v.is_seed);
      } catch {
        return false;
      }
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // One call: the full block includes the header fields at
        // the top level.
        const [blk, isSeedOnly] = await Promise.all([
          client.getBlockByNumber(height, true),
          fetchSeedOnly(),
        ]);

        if (cancelled) return;
        setBlock(blk);
        setSeedOnly(isSeedOnly);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof RpcError && err.code === -32001) {
          setError("Block not found");
        } else if (err instanceof RpcError) {
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
  }, [height]);

  if (loading) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-muted-foreground">Loading block…</div>
      </div>
    );
  }

  if (error || !block) {
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="text-sm text-destructive">
          {error ?? "Block not found"}
        </div>
      </div>
    );
  }

  const heightNum = formatCount(block.height);
  const time = timeAgo(block.timestamp_ms);
  const isGenesis = hexToBigInt(block.height) === BigInt(0);
  const isEmergency = hexToBigInt(block.emergency_rotation) > BigInt(0);
  const bodyTxCount = block.transactions.length;
  const headerTxCount = block.tx_count;
  const countMismatch = bodyTxCount !== headerTxCount;

  // In seed-only mode the staker pool and set share route to the
  // pot, so the split shown here differs from the nominal one.
  // Same heuristic as LatestBlocks: the reward bar labels the
  // actual split, not the nominal.
  const validatorShare = seedOnly
    ? bigIntToHex(REWARD_SPLIT.producerBonus)
    : bigIntToHex(REWARD_SPLIT.producerBonus);
  const stakerShare = seedOnly
    ? "0x0"
    : bigIntToHex(REWARD_SPLIT.stakerPool);
  const potShare = seedOnly
    ? bigIntToHex(REWARD_SPLIT.stakerPool + REWARD_SPLIT.setShare)
    : bigIntToHex(REWARD_SPLIT.setShare);

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">Block #{heightNum}</h2>
        <div className="flex gap-2">
          {isEmergency && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
              Emergency rotation
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-mono">
            Final
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Row label="Height">
          <span className="font-mono">{heightNum}</span>
        </Row>

        <Row label="Timestamp">
          <Tooltip>
            <TooltipTrigger className="cursor-default">
              {time}
            </TooltipTrigger>
            <TooltipContent>
              {new Date(Number(hexToBigInt(block.timestamp_ms))).toISOString()}
            </TooltipContent>
          </Tooltip>
        </Row>

        <Row label="Produced by">
          {isGenesis ? (
            <span className="text-muted-foreground">Genesis</span>
          ) : (
            <Link
              href={`/address/${block.proposer}`}
              className="font-mono text-xs hover:underline"
            >
              {shortAddress(block.proposer, 12, 8)}
            </Link>
          )}
        </Row>

        <Row label="Transactions">
          <span>{headerTxCount.toString()}</span>
          {countMismatch && (
            <Tooltip>
              <TooltipTrigger className="ml-2 text-xs text-destructive cursor-default">
                ⚠ body has {bodyTxCount}
              </TooltipTrigger>
              <TooltipContent>
                Header reports {headerTxCount} txs, body contains {bodyTxCount}.
                This is a bug worth investigating.
              </TooltipContent>
            </Tooltip>
          )}
        </Row>

        <Row label="Block hash" wide>
          <span className="font-mono text-xs break-all">{block.hash}</span>
        </Row>

        <Row label="Parent hash" wide>
          {isGenesis ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Link
              href={`/blocks/${hexToBigInt(block.height) - BigInt(1)}`}
              className="font-mono text-xs break-all hover:underline"
            >
              {block.parent_hash}
            </Link>
          )}
        </Row>

        <Row label="Epoch">
          <span className="font-mono">{formatCount(block.epoch)}</span>
        </Row>

        <Row label="Rotation index">
          <span className="font-mono">{formatCount(block.rotation_index)}</span>
        </Row>

        <Row label="Commit round">
          <span className="font-mono">{formatCount(block.commit_round)}</span>
        </Row>

        <Row label="Active validators">
          <span className="font-mono">
            {block.active_validator_count.toString()}
          </span>
        </Row>

        <Row label="State root" wide>
          <span className="font-mono text-xs break-all">
            {block.state_root}
          </span>
        </Row>

        <Row label="Tx root" wide>
          <span className="font-mono text-xs break-all">{block.tx_root}</span>
        </Row>

        <Row label="Receipts root" wide>
          <span className="font-mono text-xs break-all">
            {block.receipts_root}
          </span>
        </Row>

        <Row label="Validator set root" wide>
          <span className="font-mono text-xs break-all">
            {block.validator_set_root}
          </span>
        </Row>

        <Row label="Total fees">
          <span>{formatClrty(block.total_fees)} CLRTY</span>
        </Row>

        <Row label="Block reward">
          <span>{formatClrty(bigIntToHex(REWARD_SPLIT.total))} CLRTY</span>
        </Row>

        <Row label="Reward split" wide>
          <RewardBar
            validatorShare={formatClrty(validatorShare)}
            stakerShare={formatClrty(stakerShare)}
            potShare={formatClrty(potShare)}
            seedOnly={seedOnly}
          />
        </Row>
      </div>
    </div>
  );
};

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

export default Overview;