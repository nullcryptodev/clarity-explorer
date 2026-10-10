import { FC } from "react"

// Three-state connection indicator. The panels share this so
// their badges never disagree.
//
//   null  — the panel has not yet completed its first fetch. Shown
//           as "Connecting…" with a yellow dot, not "Offline" with
//           red. This is what stops the initial render from
//           flashing "Offline" for the ~50–200ms before the first
//           RPC response lands.
//   true  — last fetch succeeded. Green dot, "Live".
//   false — last fetch failed. Red dot, "Offline". The panel is
//           also expected to set its error state so the user sees
//           why it's offline.

export type ConnectionState = boolean | null

type Props = {
  state: ConnectionState
}

export const ConnectionDot: FC<Props> = ({ state }) => {
  const color =
    state === null
      ? "bg-yellow-500"
      : state
        ? "bg-green-500"
        : "bg-red-500"

  const label =
    state === null ? "Connecting…" : state ? "Live" : "Offline"

  return (
    <div className="flex items-center gap-2 text-xs opacity-60">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  )
}