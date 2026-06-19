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
  { id: "trading-calendar",      label: "Trading calendar",             group: "history" },
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

/**
 * Dashboard rows — stable IDs the user can reorder. Rows can contain a single
 * widget (most) or a pair grouped in one of the page's grid containers.
 *
 * Each row has a `requiresAdvanced` flag — these are gated behind the
 * Lite/Full mode toggle (resolved separately in the page).
 */
export type DashboardRow = {
  id: string
  label: string
  widgets: string[]
  requiresAdvanced?: boolean
}

export const ROW_CATALOG: DashboardRow[] = [
  { id: "row-ticker",        label: "Ticker tape",            widgets: ["ticker-tape"] },
  { id: "row-coach",         label: "Coach AI Daily Brief",   widgets: ["coach-nudge"], requiresAdvanced: true },
  { id: "row-weekly-retro",  label: "Weekly Retrospective",   widgets: ["weekly-retro"], requiresAdvanced: true },
  { id: "row-pnl",           label: "P&L strip",              widgets: ["pnl-strip"] },
  { id: "row-today-plan",    label: "Today's plan",           widgets: ["today-plan"] },
  { id: "row-prop-phase",    label: "Prop firm tracker",      widgets: ["prop-phase"] },
  { id: "row-correlation",   label: "Correlation warning",    widgets: ["correlation-warning"], requiresAdvanced: true },
  { id: "row-pip-streak",    label: "Pip stats / Streak",     widgets: ["pip-stats", "streak-card"] },
  { id: "row-equity-side",   label: "Equity curve · Risk · Margin · Session", widgets: ["equity-curve", "risk-gauge", "margin-call", "session-clock"] },
  { id: "row-live-pnl",      label: "Live P&L",               widgets: ["live-pnl"] },
  { id: "row-open-positions", label: "Open positions",        widgets: ["open-positions"] },
  { id: "row-recent-trades", label: "Recent trades",          widgets: ["recent-trades"] },
  { id: "row-trading-calendar", label: "Trading calendar",    widgets: ["trading-calendar"] },
  { id: "row-analytics",     label: "Analytics summary",      widgets: ["analytics-summary"], requiresAdvanced: true },
  { id: "row-journal-side",  label: "Journal · Mood · Watchlist", widgets: ["journal-feed", "mood-checkin", "watchlist"] },
  { id: "row-playbook-cal",  label: "Playbooks · Calendar",   widgets: ["playbooks-card", "calendar-card"] },
]

/**
 * Resolve the user's saved row order against the catalog. Saved IDs that no
 * longer exist are dropped silently; new rows that aren't in the saved order
 * are appended at the end (so a new release surfaces them rather than hiding
 * them).
 */
export function resolveRowOrder(layout: DashboardLayout): DashboardRow[] {
  const saved = layout.order ?? []
  const byId = new Map(ROW_CATALOG.map((r) => [r.id, r]))
  const seen = new Set<string>()
  const ordered: DashboardRow[] = []
  for (const id of saved) {
    const row = byId.get(id)
    if (row && !seen.has(id)) { ordered.push(row); seen.add(id) }
  }
  for (const row of ROW_CATALOG) {
    if (!seen.has(row.id)) { ordered.push(row); seen.add(row.id) }
  }
  return ordered
}
