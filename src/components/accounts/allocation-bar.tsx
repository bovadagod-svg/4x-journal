import type { Account } from "./accounts-context"
import { formatUSD } from "@/lib/finance"

export function AllocationBar({ accounts }: { accounts: Account[] }) {
  const totalEquity = accounts.reduce((s, a) => s + Number(a.equity ?? 0), 0)
  if (totalEquity <= 0) return null

  const allocations = accounts
    .map((a) => ({ ...a, share: (Number(a.equity ?? 0) / totalEquity) * 100 }))
    .filter((a) => a.share > 0)
    .sort((a, b) => b.share - a.share)

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <h3 className="card-title">Capital Allocation</h3>
          <p className="card-subtitle">Where your equity is parked</p>
        </div>
        <span className="tnum" style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
          {formatUSD(totalEquity)}
        </span>
      </div>

      {/* Stacked bar */}
      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
        {allocations.map((a) => (
          <div
            key={a.id}
            title={`${a.broker} · ${a.label} — ${a.share.toFixed(1)}%`}
            style={{
              width: `${a.share}%`,
              background: a.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 600, color: "#fff",
              minWidth: a.share > 1 ? 30 : 0,
            }}
          >
            {a.share > 8 ? `${a.share.toFixed(0)}%` : ""}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        {allocations.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, minWidth: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {a.broker} <span style={{ color: "var(--c-fg-muted)" }}>· {a.label}</span>
            </span>
            <span className="tnum" style={{ color: "var(--c-fg-muted)", flexShrink: 0 }}>{a.share.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
