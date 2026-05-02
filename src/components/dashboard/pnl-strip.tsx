import { Sparkline } from "@/components/charts/sparkline"
import { formatUSD } from "@/lib/finance"

type Period = { value: number; trades: number; spark: number[] }

export function PnLStrip({
  today,
  week,
  month,
}: {
  today: Period
  week: Period
  month: Period
}) {
  return (
    <div className="stat-strip">
      <PnLCard label="P&L Today" period={`${today.trades} trade${today.trades === 1 ? "" : "s"}`} pnl={today.value} spark={today.spark} />
      <PnLCard label="P&L Week" period="Last 7 days" pnl={week.value} spark={week.spark} />
      <PnLCard label="P&L Month" period="Last 30 days" pnl={month.value} spark={month.spark} />
      <WinRateCard week={week} todayCount={today.trades} />
    </div>
  )
}

function PnLCard({ label, period, pnl, spark }: { label: string; period: string; pnl: number; spark: number[] }) {
  const tone = pnl > 0 ? "green" : pnl < 0 ? "red" : "neutral"
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg-muted)"
  const sparkColor = tone === "green" ? "var(--c-green)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg-dim)"
  return (
    <div className="card" style={{ padding: "16px 18px", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 1 }}>{period}</div>
        </div>
        {pnl !== 0 && (
          <span className={pnl > 0 ? "chip chip-green" : "chip chip-red"} style={{ fontSize: 10.5 }}>
            {pnl > 0 ? "▲" : "▼"} {Math.abs(pnl).toFixed(2)}
          </span>
        )}
      </div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color }}>
        {formatUSD(pnl, { signed: true })}
      </div>
      <div style={{ marginTop: 10, height: 32 }}>
        <Sparkline points={spark} color={sparkColor} width={280} height={32} />
      </div>
    </div>
  )
}

function WinRateCard({ week, todayCount }: { week: Period; todayCount: number }) {
  const wins = week.spark.filter((_v, i, arr) => i > 0 && arr[i] - arr[i - 1] > 0).length
  const wr = week.trades > 0 ? Math.round((wins / week.trades) * 100) : null
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>Win rate</div>
        <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 1 }}>Last 7 days</div>
      </div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--c-fg)" }}>
        {wr != null ? `${wr}%` : "—"}
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--c-fg-muted)" }}>
        {todayCount > 0 ? `${todayCount} trade${todayCount === 1 ? "" : "s"} today` : "No trades today"}
      </div>
    </div>
  )
}
