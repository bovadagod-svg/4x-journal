import { Icon } from "@/components/icons"
import type { OverallStats } from "@/lib/queries/analytics"
import { formatUSD } from "@/lib/finance"

/**
 * Coach AI banner — currently surfaces a deterministic narrative built from
 * the user's own stats. Phase 10 swaps the body for an Anthropic call that
 * reads the last N trades and returns a tailored insight.
 */
export function CoachNudge({ stats }: { stats: OverallStats | null }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(67, 18, 160, 0.22), rgba(105, 50, 212, 0.06))",
        border: "1px solid rgba(105, 50, 212, 0.35)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #4312A0, #6932D4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="sparkle" size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>
              Coach AI · Daily Brief
            </span>
            <span className="chip chip-purple" style={{ fontSize: 9.5, padding: "1px 6px" }}>BETA</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
            {narrative(stats)}
          </p>
        </div>
      </div>
    </div>
  )
}

function narrative(stats: OverallStats | null): React.ReactNode {
  if (!stats || stats.closedTrades === 0) {
    return (
      <>
        Log or sync a few trades and I&apos;ll start surfacing patterns —
        win rate by pair, edge per setup, time-of-day clustering, drawdown risk.
      </>
    )
  }
  if (stats.closedTrades < 5) {
    return (
      <>
        Just <strong style={{ color: "var(--c-fg)" }}>{stats.closedTrades}</strong> closed trade
        {stats.closedTrades === 1 ? "" : "s"} so far — analytics unlock at 5. Keep logging.
      </>
    )
  }

  const profitable = stats.totalPnL > 0
  const wrColor = profitable ? "var(--c-green-bright)" : "var(--c-red-bright)"
  const tone = profitable ? "in the green" : "underwater"
  const pair = stats.bestPair?.pair ?? "your top pair"

  return (
    <>
      You&apos;re currently <strong style={{ color: wrColor }}>{formatUSD(stats.totalPnL, { signed: true })}</strong> across{" "}
      <strong style={{ color: "var(--c-fg)" }}>{stats.closedTrades}</strong> closed trades — {tone} with a{" "}
      <strong style={{ color: "var(--c-fg)" }}>{stats.winRate ?? 0}%</strong> win rate.
      {stats.bestPair ? (
        <> Best edge is <strong style={{ color: "var(--c-fg)" }}>{pair}</strong> ({formatUSD(stats.bestPair.pnl, { signed: true })}).</>
      ) : null}
      {stats.maxDrawdown != null && stats.maxDrawdown > 10 ? (
        <> Watch drawdown — <strong style={{ color: "var(--c-red-bright)" }}>{stats.maxDrawdown}%</strong> peak-to-trough is past the comfort zone.</>
      ) : null}
    </>
  )
}
