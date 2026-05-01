import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"

export function PnLStrip({
  today,
}: {
  today: { value: number; trades: number; wins: number; losses: number }
}) {
  const isPositive = today.value > 0
  const isFlat = today.value === 0
  const tone = isFlat ? "neutral" : isPositive ? "green" : "red"
  const winRate = today.trades > 0 ? Math.round((today.wins / today.trades) * 100) : null

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      <Stat
        label="Today's P&L"
        value={formatUSD(today.value, { signed: true })}
        sublabel={today.trades > 0 ? `${today.trades} trade${today.trades === 1 ? "" : "s"}` : "No closed trades"}
        tone={tone}
        big
      />
      <Stat
        label="Win rate (today)"
        value={winRate != null ? `${winRate}%` : "—"}
        sublabel={today.trades > 0 ? `${today.wins}W · ${today.losses}L` : "—"}
      />
      <Stat label="Week (placeholder)" value="—" sublabel="Wired in Phase 4" />
      <Stat label="Month (placeholder)" value="—" sublabel="Wired in Phase 4" />
    </div>
  )
}

function Stat({
  label, value, sublabel, tone, big,
}: {
  label: string; value: string; sublabel?: string; tone?: "green" | "red" | "neutral"; big?: boolean
}) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
        {tone === "green" && <Icon name="arrowUp" size={11} color="var(--c-green-bright)" />}
        {tone === "red" && <Icon name="arrowDown" size={11} color="var(--c-red-bright)" />}
      </div>
      <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: big ? 24 : 18, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{sublabel}</div>}
    </div>
  )
}
