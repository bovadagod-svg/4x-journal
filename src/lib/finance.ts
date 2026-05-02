// Pure helpers for trade math.
// Keep these dependency-free so they can be used in server actions, RSC, and client.

export function computeR(args: {
  side: "long" | "short"
  entry: number
  stop: number | null | undefined
  exit: number | null | undefined
}): number | null {
  const { side, entry, stop, exit } = args
  if (exit == null || stop == null) return null
  const risk = side === "long" ? entry - stop : stop - entry
  if (risk <= 0) return null
  const reward = side === "long" ? exit - entry : entry - exit
  return Number((reward / risk).toFixed(3))
}

export function computePnL(args: {
  side: "long" | "short"
  entry: number
  exit: number | null | undefined
  size: number
}): number | null {
  const { side, entry, exit, size } = args
  if (exit == null) return null
  const move = side === "long" ? exit - entry : entry - exit
  return Number((move * size).toFixed(2))
}

export function formatUSD(n: number, opts: { signed?: boolean; max?: number; min?: number } = {}) {
  const { signed = false, max = 2, min = 2 } = opts
  const sign = signed && n > 0 ? "+" : ""
  return `${sign}${n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })}`
}

export const COMMON_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "USD/CHF", "NZD/USD", "EUR/GBP",
  "GBP/JPY", "EUR/JPY", "AUD/JPY", "XAU/USD",
]
