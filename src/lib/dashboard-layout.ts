/**
 * Pure helpers for dashboard widget visibility. The layout JSONB on
 * user_settings is shaped `{ hidden: string[], order?: string[] }`.
 *
 * Widget IDs are stable kebab-case strings (e.g. "coach-nudge"). New
 * widgets get added to WIDGET_CATALOG below — keep the ID stable across
 * renames so users' hidden lists don't get reset.
 */

export type DashboardLayout = {
  hidden: string[]
  order?: string[]
}

export type WidgetMeta = {
  id: string
  label: string
  group: "intel" | "live" | "history" | "discipline" | "context"
  /** Hidden by default in Lite mode. UI shows them as already-greyed in customizer. */
  liteHidden?: boolean
}

export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: "ticker-tape",           label: "Ticker tape",                  group: "context" },
  { id: "coach-nudge",           label: "Coach AI · Daily Brief",       group: "intel", liteHidden: true },
  { id: "weekly-retro",          label: "Weekly Retrospective",         group: "intel", liteHidden: true },
  { id: "pnl-strip",             label: "P&L strip (today/week/month)", group: "live" },
  { id: "today-plan",            label: "Today's plan",                 group: "discipline" },
  { id: "prop-phase",            label: "Prop firm tracker",            group: "live" },
  { id: "correlation-warning",   label: "Correlation warning",          group: "live", liteHidden: true },
  { id: "pip-stats",             label: "Pip stats",                    group: "history" },
  { id: "streak-card",           label: "Streak card",                  group: "history" },
  { id: "equity-curve",          label: "Equity curve",                 group: "history" },
  { id: "risk-gauge",            label: "Risk gauge",                   group: "live" },
  { id: "margin-call",           label: "Margin call card",             group: "live" },
  { id: "session-clock",         label: "Session clock",                group: "context" },
  { id: "live-pnl",              label: "Live P&L (open positions)",    group: "live" },
  { id: "open-positions",        label: "Open positions list",          group: "live" },
  { id: "recent-trades",         label: "Recent trades",                group: "history" },
  { id: "analytics-summary",     label: "Analytics summary",            group: "history", liteHidden: true },
  { id: "journal-feed",          label: "Journal feed",                 group: "discipline" },
  { id: "mood-checkin",          label: "Mood check-in",                group: "discipline" },
  { id: "watchlist",             label: "Watchlist",                    group: "context" },
  { id: "playbooks-card",        label: "Playbooks summary",            group: "discipline" },
  { id: "calendar-card",         label: "Economic calendar",            group: "context" },
]

export function parseDashboardLayout(raw: unknown): DashboardLayout {
  if (typeof raw !== "object" || raw === null) return { hidden: [] }
  const v = raw as Record<string, unknown>
  const hidden = Array.isArray(v.hidden) ? v.hidden.filter((s): s is string => typeof s === "string") : []
  const order = Array.isArray(v.order) ? v.order.filter((s): s is string => typeof s === "string") : undefined
  return { hidden, order }
}

export function isWidgetVisible(id: string, layout: DashboardLayout): boolean {
  return !layout.hidden.includes(id)
}
