import type { IconName } from "@/components/icons"

export type SectionId =
  | "dashboard" | "ledger" | "journal" | "analytics"
  | "calendar" | "playbooks" | "watchlist" | "backtest"
  | "risk" | "accounts" | "reports" | "settings"

export const SECTION_META: Record<SectionId, { title: string; subtitle: string; icon: IconName }> = {
  dashboard: { title: "Dashboard", subtitle: "Your trading day at a glance", icon: "dashboard" },
  ledger: { title: "Ledger", subtitle: "Every trade, every fill, every R", icon: "journal" },
  journal: { title: "Journal", subtitle: "Pre-trade thinking, live notes, post-trade lessons", icon: "edit" },
  analytics: { title: "Analytics", subtitle: "Performance breakdown across pairs, setups, sessions", icon: "analytics" },
  calendar: { title: "Economic Calendar", subtitle: "High-impact events for your watchlist", icon: "calendar" },
  playbooks: { title: "Playbooks", subtitle: "Documented setups with rules & expectancy", icon: "playbook" },
  watchlist: { title: "Watchlist", subtitle: "Pre-session targets and bias", icon: "watchlist" },
  backtest: { title: "Backtesting", subtitle: "Replay setups against historical data", icon: "backtest" },
  risk: { title: "Risk Manager", subtitle: "Daily limits, exposure, drawdown rules", icon: "risk" },
  accounts: { title: "Accounts", subtitle: "Connected brokers & prop firms", icon: "accounts" },
  reports: { title: "Reports", subtitle: "Export tax-ready P&L and prop-firm reports", icon: "reports" },
  settings: { title: "Settings", subtitle: "Preferences, integrations, billing", icon: "settings" },
}

type NavItem =
  | { kind: "link"; id: SectionId; label: string; icon: IconName; badge?: number; indent?: boolean }
  | { kind: "section"; label: string }

export const NAV_ITEMS: NavItem[] = [
  { kind: "link", id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { kind: "section", label: "Trading" },
  { kind: "link", id: "ledger", label: "Ledger", icon: "journal", indent: true },
  { kind: "link", id: "journal", label: "Journal", icon: "edit", indent: true },
  { kind: "section", label: "Insight" },
  { kind: "link", id: "analytics", label: "Analytics", icon: "analytics" },
  { kind: "link", id: "playbooks", label: "Playbooks", icon: "playbook" },
  { kind: "link", id: "calendar", label: "Calendar", icon: "calendar" },
  { kind: "link", id: "watchlist", label: "Watchlist", icon: "watchlist" },
  { kind: "section", label: "Manage" },
  { kind: "link", id: "backtest", label: "Backtesting", icon: "backtest" },
  { kind: "link", id: "risk", label: "Risk Manager", icon: "risk" },
  { kind: "link", id: "accounts", label: "Accounts", icon: "accounts" },
  { kind: "link", id: "reports", label: "Reports", icon: "reports" },
  { kind: "link", id: "settings", label: "Settings", icon: "settings" },
]
