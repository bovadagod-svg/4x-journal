import { realizedPips, slPips, tpPips, formatPips } from "@/lib/pip"
import { Icon } from "@/components/icons"
import type { Trade } from "@/lib/queries/trades"

/**
 * Dashboard mini-card showing pip-flow stats for the last 7 days.
 *
 *   - Total pips this week (signed)
 *   - Avg SL pips, Avg TP pips, Avg R:R
 *   - Avg pips won vs avg pips lost
 *
 * Tiny + dense — designed to live alongside the existing PnLStrip.
 */
export function PipStatsCard({ trades }: { trades: Trade[] }) {
  const weekAgo = Date.now() - 7 * 86_400_000
  const closed = trades.filter((t) => t.status === "closed" && t.closed_at && new Date(t.closed_at).getTime() >= weekAgo)
  if (closed.length === 0) return null

  const realized: number[] = []
  const slDistances: number[] = []
  const tpDistances: number[] = []
  const winningPips: number[] = []
  const losingPips: number[] = []

  for (const t of closed) {
    const side = t.side as "long" | "short"
    const r = realizedPips({ side, entry: Number(t.entry_price), exit: t.exit_price != null ? Number(t.exit_price) : null, pair: t.pair })
    if (r != null) {
      realized.push(r)
      if (r > 0) winningPips.push(r)
      else if (r < 0) losingPips.push(r)
    }
    const sl = slPips({ side, entry: Number(t.entry_price), stop: t.stop_price != null ? Number(t.stop_price) : null, pair: t.pair })
    if (sl != null) slDistances.push(sl)
    const tp = tpPips({ side, entry: Number(t.entry_price), target: t.target_price != null ? Number(t.target_price) : null, pair: t.pair })
    if (tp != null) tpDistances.push(tp)
  }

  const totalPips = realized.reduce((s, x) => s + x, 0)
  const avg = (a: number[]) => a.length === 0 ? null : a.reduce((s, x) => s + x, 0) / a.length
  const avgSL = avg(slDistances)
  const avgTP = avg(tpDistances)
  const avgWin = avg(winningPips)
  const avgLoss = avg(losingPips)
  const avgRR = avgSL != null && avgSL > 0 && avgTP != null ? avgTP / avgSL : null

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <h3 className="card-title" style={{ fontSize: 13 }}>Pip Stats · 7 days</h3>
        <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{closed.length} closed</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net pips</div>
          <div className="tnum" style={{
            fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em",
            color: totalPips > 0 ? "var(--c-green-bright)" : totalPips < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
          }}>
            {totalPips > 0 ? "+" : ""}{totalPips.toFixed(0)}p
          </div>
        </div>
        {avgRR != null && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg R:R</div>
            <div className="tnum" style={{ fontSize: 16, fontWeight: 600 }}>1 : {avgRR.toFixed(2)}</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6 }}>
        <Mini label="Avg SL" value={formatPips(avgSL)} />
        <Mini label="Avg TP" value={formatPips(avgTP)} />
        <Mini label="Avg win" value={avgWin != null ? `+${avgWin.toFixed(1)}p` : "—"} color="var(--c-green-bright)" />
        <Mini label="Avg loss" value={avgLoss != null ? `${avgLoss.toFixed(1)}p` : "—"} color="var(--c-red-bright)" />
      </div>
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 6, padding: "6px 8px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 1 }}>{value}</div>
    </div>
  )
}
