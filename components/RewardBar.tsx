"use client"

import { FC } from "react"
import { cn } from "@/lib/utils"

type RewardBarProps = {
  validatorShare: string
  stakerShare: string
  potShare: string
  className?: string
  // True when the block was produced by a seed-only active set.
  // On a seed-only chain the staker pool and set share route to
  // the pot, so the nominal split shown by this bar doesn't match
  // the actual per-block distribution. When this flag is set, the
  // bar renders the seed-only split instead of the nominal one.
  //
  // Defaults to false, which shows the nominal 12/40/48 split.
  seedOnly?: boolean
}

const NOMINAL_SEGMENTS = [
  { key: "validatorShare", label: "Validators", color: "bg-green-400" },
  { key: "stakerShare", label: "Stakers", color: "bg-blue-400" },
  { key: "potShare", label: "Pot", color: "bg-yellow-400" },
] as const

const SEED_ONLY_SEGMENTS = [
  { key: "validatorShare", label: "Seeds", color: "bg-green-400" },
  { key: "stakerShare", label: "Stakers", color: "bg-blue-400" },
  { key: "potShare", label: "Pot", color: "bg-yellow-400" },
] as const

function toNumber(value: string): number {
  // Strip thousands separators. Returns NaN for placeholder strings
  // (em-dash, empty) or anything unparseable, so the caller can
  // distinguish "legitimately zero" from "did not parse."
  const cleaned = value.replace(/,/g, "").trim()
  if (!cleaned || cleaned === "—" || cleaned === "-") return NaN
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function toSegmentValue(value: string): number {
  const n = toNumber(value)
  return Number.isFinite(n) ? n : 0
}

const RewardBar: FC<RewardBarProps> = ({
  validatorShare,
  stakerShare,
  potShare,
  className,
  seedOnly = false,
}) => {
  const values = {
    validatorShare: toSegmentValue(validatorShare),
    stakerShare: toSegmentValue(stakerShare),
    potShare: toSegmentValue(potShare),
  }

  const total = values.validatorShare + values.stakerShare + values.potShare

  if (total <= 0) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        No reward data
      </div>
    )
  }

  const segments = seedOnly ? SEED_ONLY_SEGMENTS : NOMINAL_SEGMENTS

  // Compute each segment's fraction once. Used by both the bar
  // and the label row, so they can't disagree.
  const withPct = segments.map((segment) => ({
    ...segment,
    value: values[segment.key],
    pct: (values[segment.key] / total) * 100,
  }))

  // Only render segments that actually contribute to the bar. On a
  // seed-only chain the staker segment is always 0% and would
  // otherwise show a label with no matching color.
  const visible = withPct.filter((s) => s.pct > 0)

  const tooltip = seedOnly
    ? "Seed-only chain: the producer bonus is split evenly across seeds, " +
    "and the set share plus staker pool route to the pot."
    : "Nominal reward split: 12% to validators, 40% to stakers, 48% to the pot. " +
    "Actual per-block payouts may differ on a seed-only chain."

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        title={tooltip}
      >
        {visible.map((segment) => (
          <div
            key={segment.key}
            className={cn("h-full", segment.color)}
            style={{ width: `${segment.pct}%` }}
            title={`${segment.label}: ${segment.value.toFixed(5)} (${segment.pct.toFixed(1)}%)`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mx-auto">
        {visible.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1">
            <span className={cn("size-2 rounded-full", segment.color)} />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export { RewardBar }