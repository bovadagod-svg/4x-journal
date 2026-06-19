import { createClient } from "@/lib/supabase/server"
import { computePnL } from "@/lib/finance"
import { marginStatusColor, MARGIN_COLOR_VAR } from "@/lib/status"
import { withAlpha } from "@/lib/color"
import type { Account } from "@/components/accounts/accounts-context"

type Scenario = {
  label: string
  projectedBalance: number
  projectedLevel: number | null
  pnlSum: number
}

function projectScenario(args: {
  trades: Array<{ side: string; size: number; entry_price: number; stop_price: number | null; target_price: number | null }>
  balance: number
  marginUsed: number | null
  scope: "stops" | "targets"
}): Scenario {
  let pnlSum = 0
  for (const t of args.trades) {
    const target = args.scope === "stops" ? t.stop_price : t.target_price
    if (target == null) continue
    const p = computePnL({
      side: t.side === "long" ? "long" : "short",
      entry: Number(t.entry_price),
      exit: Number(target),
      size: Number(t.size),
    })
    if (p != null) pnlSum += p
  }
  const projectedBalance = args.balance + pnlSum
  const projectedLevel = args.marginUsed != null && args.marginUsed > 0
    ? (projectedBalance / args.marginUsed) * 100
    : null
  return {
    label: args.scope === "stops" ? "If all stops hit" : "If all targets hit",
    projectedBalance,
    projectedLevel,
    pnlSum,
  }
}

export async function MarginProjection({ account }: { account: Account }) {
  // Only render when broker reports margin_level — manual accounts can't project.
  if (account.margin_level == null) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from("trades")
    .select("side, size, entry_price, stop_price, target_price")
    .eq("account_id", account.id)
    .eq("status", "open")

  const trades = (data ?? []).map((t) => ({
    side: t.side,
    size: Number(t.size),
    entry_price: Number(t.entry_price),
    stop_price: t.stop_price != null ? Number(t.stop_price) : null,
    target_price: t.target_price != null ? Number(t.target_price) : null,
  }))

  if (trades.length === 0) return null

  const balance = Number(account.balance)
  const marginUsed = account.margin_used != null ? Number(account.margin_used) : null

  const stops = projectScenario({ trades, balance, marginUsed, scope: "stops" })
  const targets = projectScenario({ trades, balance, marginUsed, scope: "targets" })

  return (
    <div className="card" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600 }}>Margin projection</h4>
        <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>
          {trades.length} open trade{trades.length === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        <ProjectionPill scenario={stops} variant="stops" />
        <ProjectionPill scenario={targets} variant="targets" />
      </div>
    </div>
  )
}

function ProjectionPill({ scenario, variant }: { scenario: Scenario; variant: "stops" | "targets" }) {
  const status = marginStatusColor(scenario.projectedLevel)
  const color = MARGIN_COLOR_VAR[status]
  const valueStr = scenario.projectedLevel != null ? `${scenario.projectedLevel.toFixed(0)}%` : "—"
  const pnl = scenario.pnlSum
  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      background: "var(--c-bg-elev-2)",
      border: `1px solid ${withAlpha(color, 20)}`,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{scenario.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color }}>{valueStr}</span>
        <span className="tnum" style={{ fontSize: 11, color: pnl > 0 ? "var(--c-green-bright)" : pnl < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)" }}>
          {pnl > 0 ? "+" : ""}{pnl.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>
        {variant === "stops" ? "worst-case if every stop is hit" : "best-case if every target is hit"}
      </div>
    </div>
  )
}
