import "server-only"
import { cookies } from "next/headers"

/**
 * Dashboard density mode — "lite" hides advanced widgets that need lots of
 * trade data to be useful (Coach AI, Analytics summary, Correlation warnings).
 * Stored in a cookie to keep schema clean while still persisting per-device.
 *
 * Default: "auto". In auto mode, the page itself decides based on closed-trade
 * count (<50 → lite). Explicit "lite" / "full" overrides come from the toggle.
 */
export type DashboardMode = "auto" | "lite" | "full"

const COOKIE = "dashboard_mode"

export async function getDashboardMode(): Promise<DashboardMode> {
  const c = await cookies()
  const v = c.get(COOKIE)?.value
  if (v === "lite" || v === "full" || v === "auto") return v
  return "auto"
}

/**
 * Resolves the *effective* mode given the user's preference and current trade
 * sample size. "auto" → lite when sample < 50 closed trades, otherwise full.
 */
export function resolveDashboardMode(mode: DashboardMode, closedTradeCount: number): "lite" | "full" {
  if (mode === "lite" || mode === "full") return mode
  return closedTradeCount < 50 ? "lite" : "full"
}
