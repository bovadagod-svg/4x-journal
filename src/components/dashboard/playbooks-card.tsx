import Link from "next/link"
import { Icon } from "@/components/icons"
import type { Playbook, PlaybookStats } from "@/lib/queries/playbooks"
import { formatUSD } from "@/lib/finance"

export function PlaybooksCard({ playbooks }: { playbooks: Array<Playbook & { stats: PlaybookStats }> }) {
  const top = [...playbooks]
    .sort((a, b) => b.stats.totalPnL - a.stats.totalPnL)
    .slice(0, 4)

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Playbooks</h3>
          <p className="card-subtitle">{playbooks.length} total · top by P&L</p>
        </div>
        <Link href="/playbooks" className="btn" style={{ fontSize: 12 }}>Manage</Link>
      </div>
      {top.length === 0 ? (
        <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 12.5 }}>
          No playbooks yet. <Link href="/playbooks" style={{ color: "var(--c-accent-bright)" }}>Create one →</Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {top.map((p) => {
            const tone = p.stats.totalPnL > 0 ? "green" : p.stats.totalPnL < 0 ? "red" : undefined
            const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
            return (
              <li key={p.id} style={{ borderTop: "1px solid var(--c-border)", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>
                    {p.stats.trades} trades · {p.stats.winRate != null ? `${p.stats.winRate}% WR` : "—"}
                  </div>
                </div>
                <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color, whiteSpace: "nowrap" }}>
                  {p.stats.closedTrades > 0 ? formatUSD(p.stats.totalPnL, { signed: true }) : "—"}
                </span>
                <Icon name="chevronRight" size={11} color="var(--c-fg-dim)" />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
