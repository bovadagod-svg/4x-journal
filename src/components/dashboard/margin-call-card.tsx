import { getUserAccounts } from "@/lib/queries/accounts"
import { marginStatusColor, MARGIN_COLOR_VAR, type MarginStatus } from "@/lib/status"

const STATUS_LABEL: Record<MarginStatus, string> = {
  green: "safe",
  amber: "watch",
  red: "danger",
  black: "margin call",
  muted: "no data",
}

const STATUS_RANK: Record<MarginStatus, number> = {
  black: 4,
  red: 3,
  amber: 2,
  green: 1,
  muted: 0,
}

export async function MarginCallCard() {
  const accounts = await getUserAccounts()
  const tracked = accounts.filter((a) => a.margin_level != null)

  if (tracked.length === 0) {
    return (
      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <h3 className="card-title">Margin Call Risk</h3>
          <p className="card-subtitle">Live margin levels from your broker</p>
        </div>
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          Sync a TradeLocker account to see live margin levels here.
        </div>
      </div>
    )
  }

  const rows = tracked
    .map((a) => {
      const level = Number(a.margin_level)
      const status = marginStatusColor(level)
      return { id: a.id, label: a.label, broker: a.broker, level, status }
    })
    .sort((x, y) => STATUS_RANK[y.status] - STATUS_RANK[x.status])

  const dangerCount = rows.filter((r) => r.status === "red" || r.status === "black").length
  const watchCount = rows.filter((r) => r.status === "amber").length
  const headlineColor = MARGIN_COLOR_VAR[rows[0].status]

  return (
    <div className="card">
      <div style={{ marginBottom: 12 }}>
        <h3 className="card-title">Margin Call Risk</h3>
        <p className="card-subtitle">
          {dangerCount > 0
            ? `${dangerCount} account${dangerCount === 1 ? "" : "s"} near margin call`
            : watchCount > 0
              ? `${watchCount} account${watchCount === 1 ? "" : "s"} on watch`
              : "All accounts safe"}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => {
          const c = MARGIN_COLOR_VAR[r.status]
          return (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "12px 1fr auto auto",
                gap: 10,
                alignItems: "center",
                padding: "8px 10px",
                background: "var(--c-bg-elev-2)",
                border: "1px solid var(--c-border)",
                borderRadius: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: r.status === "red" || r.status === "black" ? `0 0 8px ${c}` : "none" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>{r.broker}</div>
              </div>
              <span className="tnum" style={{ fontSize: 14, fontWeight: 600, color: c, fontFamily: "var(--font-display)" }}>{r.level.toFixed(0)}%</span>
              <span style={{ fontSize: 10, color: c, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{STATUS_LABEL[r.status]}</span>
            </div>
          )
        })}
      </div>
      {dangerCount === 0 && watchCount === 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: headlineColor, fontWeight: 500 }}>
          All margin levels above 300% — no action needed.
        </div>
      )}
    </div>
  )
}
