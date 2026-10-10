"use client";

import { FC, useEffect, useState } from "react";
import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";
import { formatCount, formatClrtyWithSymbol, networkNameFromChainId } from "@/lib/format";
import type { NodeStatus, MempoolStats } from "@/lib/types";

// For v1 this is direct RPC polling. Once an indexer exists, replace the
// polling logic with a single indexer query. The component itself doesn't
// need to change, only the data source.

interface ChainStat {
  text: string;
  value: string;
}

const PLACEHOLDER: ChainStat[] = [
  { text: "Network", value: "—" },
  { text: "Current Height", value: "—" },
  { text: "Total Transactions", value: "—" },
  { text: "Blockchain Fee", value: "—" },
  { text: "Unique Tokens", value: "—" },
];

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const ChainInformation: FC = () => {
  const [stats, setStats] = useState<ChainStat[]>(PLACEHOLDER);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const fetchStats = async () => {
      try {
        const [status, mempool] = await Promise.all([
          client.status(),
          client.getMempoolStats(),
        ]);

        if (cancelled) return;

        setStats(buildStats(status, mempool));
        setConnected(true);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;

        // Not a hard error — the node just isn't up yet. Keep the
        // placeholders visible and try again on the next tick.
        if (!(err instanceof RpcError)) {
          console.warn("ChainInformation: unexpected error", err);
        }
        setConnected(false);
        setLoading(false);
      }
    };

    void fetchStats();
    timer = setInterval(fetchStats, 5_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="lg:mx-auto lg:w-5xl border rounded-xl p-4 bg-card flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-center font-medium flex-1">Chain Information</h1>
        <ConnectionDot connected={connected} loading={loading} />
      </div>

      <div className="flex gap-10 p-2 justify-center">
        {stats.map((item, index) => (
          <div key={index} className="w-full">
            <h1 className="text-sm font-medium opacity-50">{item.text}</h1>
            <p className="text-xl">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Data shaping

function buildStats(
  status: NodeStatus,
  mempool: MempoolStats,
): ChainStat[] {
  return [
    {
      text: "Network",
      value: networkNameFromChainId(status.chain_id),
    },
    {
      text: "Current Height",
      value: formatCount(status.height),
    },
    {
      // Total transactions across the chain isn't available from the
      // node yet — that's an indexer query. For v1 we show the mempool
      // size, labelled accurately so it's not confused with a lifetime
      // count.
      text: "Pending Transactions",
      value: formatCount(mempool.total_txs),
    },
    {
      // "Blockchain fee" is ambiguous — no single number represents it.
      // For v1, show the average mempool fee rate, which is what a user
      // actually pays right now. Rename if you'd rather show something
      // else.
      text: "Avg Fee Rate",
      value: formatClrtyWithSymbol(mempool.avg_fee_rate),
    },
    {
      // Unique token count is an indexer query. Show an em-dash until
      // the indexer exists.
      text: "Unique Tokens",
      value: "—",
    },
  ];
}

// Connection indicator

const ConnectionDot: FC<{ connected: boolean; loading: boolean }> = ({
  connected,
  loading,
}) => {
  const color = loading
    ? "bg-yellow-500"
    : connected
      ? "bg-green-500"
      : "bg-red-500";
  const label = loading
    ? "Connecting"
    : connected
      ? "Connected"
      : "Offline";

  return (
    <div className="flex items-center gap-2 text-xs opacity-60">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
};

export default ChainInformation;