"use client";

import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import { ButtonGroup } from "@/components/ui/button-group";

import { RpcClient, RpcError, DEFAULT_RPC_URL } from "@/lib/rpc";

// The explorer accepts five shapes of input:
//
//  Block height        a decimal number, e.g. 69
//  Block or tx hash    "0x" + 64 hex chars
//  Address             bech32m, starting with clrty / tclrty / rclrty
//  Token ID            a decimal number (same shape as block height)
//  Validator ID        a decimal number (same shape as block height)
//
// Numbers and hashes are ambiguous:
//
//  A number could be a block height, a token ID, or a validator ID.
//  A 32-byte hash could be a block hash or a transaction hash.
//
// We disambiguate by probing the node — see resolveNumber and
// resolveHash below. bech32m addresses are unambiguous; they always
// route to /address/.

type Classification =
  | { kind: "hash"; value: string }
  | { kind: "number"; value: string }
  | { kind: "address"; value: string }
  | { kind: "unknown" };

function classify(input: string): Classification {
  const q = input.trim();
  if (!q) return { kind: "unknown" };

  // Hex hash: "0x" + 64 hex chars.
  if (/^0x[a-fA-F0-9]{64}$/.test(q)) {
    return { kind: "hash", value: q.toLowerCase() };
  }

  // Bech32m address. Matches the three network HRPs.
  if (/^(clrty|tclrty|rclrty)1[02-9ac-hj-np-z]+$/i.test(q)) {
    return { kind: "address", value: q.toLowerCase() };
  }

  // Decimal number.
  if (/^\d+$/.test(q)) {
    return { kind: "number", value: q };
  }

  // "0x"-prefixed hex integer, but shorter than a full hash.
  if (/^0x[a-fA-F0-9]{1,63}$/.test(q)) {
    return { kind: "number", value: q };
  }

  return { kind: "unknown" };
}

const client = new RpcClient({ url: DEFAULT_RPC_URL });

const Search: FC = () => {
  const [searchInputText, setSearchInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(raw: string) {
    const query = raw.trim();
    if (!query) return;

    setError(null);
    const classified = classify(query);

    switch (classified.kind) {
      case "address": {
        // Bech32m addresses are unambiguous. Route directly; the
        // address page fetches the account and returns "not found"
        // if it has never been touched.
        router.push(`/address/${classified.value}`);
        return;
      }

      case "number": {
        // Numbers are ambiguous. Probe the node: block first (the
        // most common case), then validator, then token.
        setBusy(true);
        try {
          const target = await resolveNumber(classified.value);
          if (target) {
            router.push(target);
          } else {
            setError(`No block, validator, or token with ID ${query}`);
          }
        } finally {
          setBusy(false);
        }
        return;
      }

      case "hash": {
        // Hashes are ambiguous too. Probe both; transaction wins
        // because a transaction is the more likely intent when a
        // user pastes a hash.
        setBusy(true);
        try {
          const target = await resolveHash(classified.value);
          if (target) {
            router.push(target);
          } else {
            setError(`No block or transaction with hash ${query}`);
          }
        } finally {
          setBusy(false);
        }
        return;
      }

      case "unknown": {
        setError(
          "Enter a block height, a block or transaction hash, a token ID, or an address.",
        );
        return;
      }
    }
  }

  return (
    <div className="relative z-10 px-4 py-8">
      <h1 className="font-medium text-2xl">Welcome to the Clarity Explorer</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(searchInputText);
        }}
        className="p-4 flex gap-2"
      >
        <ButtonGroup className="lg:w-2xl">
          <Input
            value={searchInputText}
            onChange={(e) => {
              setSearchInputText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Search by block, transaction, address, or token"
            aria-label="Search"
            className="h-12"
            disabled={busy}
          />
          <Button
            type="submit"
            className="h-12 border-0"
            disabled={busy || searchInputText.trim().length === 0}
          >
            <SearchIcon />
          </Button>
        </ButtonGroup>
      </form>

      {error ? (
        <p className="px-4 text-sm text-destructive">{error}</p>
      ) : (
        <p className="px-4 text-sm text-muted-foreground">
          Enter a block height, a block or transaction hash, a token ID, or
          an address.
        </p>
      )}
    </div>
  );
};

// Resolve a decimal (or short hex) number to a route.
//
//  1. Block by height. The most common case.
//  2. Validator by ID.
//  3. Token by ID.
//
// Returns the path or null if none match. Each probe is a cheap
// point lookup; the point of asking the node rather than guessing is
// that the same number can be a block, a validator, and a token, and
// we want the answer that actually exists.

async function resolveNumber(input: string): Promise<string | null> {
  // Normalize to the same hex shape the RPC accepts. Decimal
  // "69" and hex "0x45" are both valid; the node accepts either.
  const asHex = input.startsWith("0x")
    ? input
    : "0x" + BigInt(input).toString(16);

  // 1. Block.
  try {
    await client.getBlockHeaderByNumber(asHex);
    return `/blocks/${BigInt(input).toString()}`;
  } catch {
    // not a block
  }

  // 2. Validator.
  try {
    await client.getValidator(asHex);
    return `/validators/${asHex}`;
  } catch {
    // not a validator
  }

  // 3. Token.
  try {
    await client.getTokenInfo(asHex);
    return `/tokens/${asHex}`;
  } catch {
    // not a token
  }

  return null;
}

// Resolve a 32-byte hash to a route.
//
//  1. Try transaction. If it hits, route to /txs/[hash].
//  2. Try block. If it hits, route to /blocks/[height] — we look
//     up the block by hash, then navigate to the canonical
//     height-based URL.

async function resolveHash(hash: string): Promise<string | null> {
  // 1. Transaction.
  try {
    await client.getTransactionByHash(hash);
    return `/txs/${hash}`;
  } catch {
    // not a tx
  }

  // 2. Block. Fetch it so we can navigate to the height URL rather
  //   than needing a separate /blocks/hash/[hash] route.
  try {
    const block = await client.getBlockByHash(hash);
    return `/blocks/${BigInt(block.height).toString()}`;
  } catch {
    // not a block
  }

  return null;
}

export default Search;