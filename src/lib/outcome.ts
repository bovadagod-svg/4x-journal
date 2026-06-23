/**
 * Trade outcome classification — single source of truth for win / loss /
 * breakeven across the app (stats, win rate, badges, coach insights, reports).
 *
 * A closed trade whose realized P&L lands within ±$100 of zero is treated as a
 * scratch / breakeven — neither a win nor a loss. This keeps marginal trades
 * (tiny wins, tiny losses, commission/swap-only outcomes) from inflating or
 * deflating performance stats.
 *
 * Win rate excludes breakevens: winRate = wins / (wins + losses). Breakevens
 * are tracked and shown separately but don't move the percentage.
 *
 * Scope: this is a PER-TRADE rule. Period aggregates (daily / weekly / monthly
 * net P&L) are sums and stay sign-based — a day that nets +$40 is not a
 * "breakeven trade". The band is compared against the stored P&L as-is; P&L is
 * recorded per trade in its account currency (USD for this workspace) and the
 * $100 threshold is not currency-converted.
 */

/** Trades within ±this many account-currency units of zero are breakeven. */
export const BREAKEVEN_THRESHOLD = 100

export type Outcome = "win" | "loss" | "breakeven"

/** Classify a closed trade's realized P&L. Returns null when P&L is unknown. */
export function classifyOutcome(pnl: number | null | undefined): Outcome | null {
  if (pnl == null || Number.isNaN(pnl)) return null
  if (pnl > BREAKEVEN_THRESHOLD) return "win"
  if (pnl < -BREAKEVEN_THRESHOLD) return "loss"
  return "breakeven"
}

export const isWin = (pnl: number): boolean => pnl > BREAKEVEN_THRESHOLD
export const isLoss = (pnl: number): boolean => pnl < -BREAKEVEN_THRESHOLD
export const isBreakeven = (pnl: number): boolean =>
  pnl >= -BREAKEVEN_THRESHOLD && pnl <= BREAKEVEN_THRESHOLD

/**
 * Win rate as a 0–100 percentage over *decisive* trades (wins + losses),
 * excluding breakevens. Rounded to a whole percent. Null when no decisive trades.
 */
export function winRatePct(wins: number, losses: number): number | null {
  const decisive = wins + losses
  return decisive > 0 ? Math.round((wins / decisive) * 100) : null
}
