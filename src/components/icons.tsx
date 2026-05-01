import type { CSSProperties } from "react"

export type IconName =
  | "dashboard" | "journal" | "analytics" | "calendar" | "playbook"
  | "watchlist" | "backtest" | "risk" | "accounts" | "reports" | "settings"
  | "bell" | "search" | "user" | "logo"
  | "chevronDown" | "chevronRight" | "chevronUp"
  | "arrowUp" | "arrowDown" | "plus" | "external" | "filter" | "flag"
  | "flame" | "target" | "book" | "moon" | "sun" | "sparkle"
  | "check" | "x" | "edit" | "play" | "refresh" | "info" | "trade"
  | "grip" | "lightning"

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  journal: <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  analytics: <><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  playbook: <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"/><path d="M9 7v10M14 9l-3 3 3 3"/></>,
  watchlist: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  backtest: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  risk: <><path d="M12 3l9 5v5c0 5-4 8-9 8s-9-3-9-8V8l9-5Z"/><path d="M12 9v4M12 15.5v.01"/></>,
  accounts: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  reports: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M9 13h6M9 17h6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  logo: <><path d="M8 6L2 12l6 6M16 6l6 6-6 6"/></>,
  chevronDown: <><path d="m6 9 6 6 6-6"/></>,
  chevronRight: <><path d="m9 6 6 6-6 6"/></>,
  chevronUp: <><path d="m6 15 6-6 6 6"/></>,
  arrowUp: <><path d="M12 19V5M5 12l7-7 7 7"/></>,
  arrowDown: <><path d="M12 5v14M19 12l-7 7-7-7"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  external: <><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></>,
  filter: <><path d="M3 4h18l-7 9v7l-4-2v-5L3 4Z"/></>,
  flag: <><path d="M4 21V4M4 4h12l-2 4 2 4H4"/></>,
  flame: <><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 9 8 11 8 13a5 5 0 0 0 10 0c0-5-6-11-6-11Z"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
  check: <><path d="m5 12 5 5L20 7"/></>,
  x: <><path d="M18 6 6 18M6 6l12 12"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
  play: <><path d="M5 3v18l15-9L5 3Z"/></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v4h1"/></>,
  trade: <><path d="M3 7h13l-3-3M21 17H8l3 3"/></>,
  grip: <><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>,
  lightning: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
}

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 1.5,
  style,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}

const FLAG_MAP: Record<string, { bg: string; fg: string; t: string }> = {
  USD: { bg: "#1A472A", fg: "#fff", t: "$" },
  EUR: { bg: "#003399", fg: "#FFD700", t: "€" },
  GBP: { bg: "#012169", fg: "#fff", t: "£" },
  JPY: { bg: "#BC002D", fg: "#fff", t: "¥" },
  AUD: { bg: "#012169", fg: "#fff", t: "A" },
  CAD: { bg: "#D52B1E", fg: "#fff", t: "C" },
  CHF: { bg: "#DA291C", fg: "#fff", t: "+" },
  NZD: { bg: "#012169", fg: "#fff", t: "N" },
  XAU: { bg: "#C9A227", fg: "#000", t: "Au" },
}

export function Flag({ code, size = 18 }: { code: string; size?: number }) {
  const c = FLAG_MAP[code] ?? { bg: "#3A3A45", fg: "#fff", t: "?" }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: c.bg,
        color: c.fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}
    >
      {c.t}
    </span>
  )
}

export function PairFlag({ pair, size = 18 }: { pair: string; size?: number }) {
  const [a, b] = pair.split("/")
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      <Flag code={a} size={size} />
      <span style={{ marginLeft: -size * 0.35 }}>
        <Flag code={b} size={size} />
      </span>
    </span>
  )
}
