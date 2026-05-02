/**
 * P&L display modes — driven by user_settings.pnl_display.
 *
 *   "money"     → "$1,234.56"   (USD currency-formatted)
 *   "rmultiple" → "+1.45R"      (uses pre-computed `r` field; falls back to —)
 *   "percent"   → "+1.23%"      (pnl ÷ account.equity at trade time)
 *
 * Only "money" is unconditionally available — the others may render "—" when
 * upstream data (R, equity) is missing.
 */
export type PnLDisplayMode = "money" | "rmultiple" | "percent"

export type PnLFormatOpts = {
  /** Source data — `pnl` is required for money/percent modes; `r` for rmultiple. */
  pnl: number | null
  r: number | null
  /** Per-trade equity at time of fill, used for percent mode. */
  equity?: number | null
  /** Show explicit "+" on positive numbers. */
  signed?: boolean
}

/**
 * Server-renderable, framework-free formatter. Used in RSCs (Ledger row, Reports).
 * For client components, prefer the `usePnLDisplay()` hook which respects user prefs.
 */
export function formatPnL(mode: PnLDisplayMode, opts: PnLFormatOpts): string {
  const signed = opts.signed ?? true
  const sign = (n: number) => (signed && n > 0 ? "+" : "")

  if (mode === "rmultiple") {
    if (opts.r == null) return "—"
    return `${sign(opts.r)}${opts.r.toFixed(2)}R`
  }

  if (mode === "percent") {
    if (opts.pnl == null || opts.equity == null || opts.equity <= 0) return "—"
    const pct = (opts.pnl / opts.equity) * 100
    return `${sign(pct)}${pct.toFixed(2)}%`
  }

  // Default: money
  if (opts.pnl == null) return "—"
  return `${sign(opts.pnl)}${opts.pnl.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
