import Link from "next/link"
import { Icon } from "@/components/icons"
import type { JournalEntry, Trade } from "@/lib/queries/trades"

export function JournalFeed({ entries, trades }: { entries: JournalEntry[]; trades: Trade[] }) {
  const tradeMap = new Map(trades.map((t) => [t.id, t]))

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Recent journal</h3>
          <p className="card-subtitle">Notes auto-saved from the Log Trade modal</p>
        </div>
        <Link href="/journal" className="btn" style={{ fontSize: 12 }}>
          View all
        </Link>
      </div>
      {entries.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          Nothing logged yet. Notes you write while logging a trade show up here.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {entries.slice(0, 5).map((e) => {
            const t = e.trade_id ? tradeMap.get(e.trade_id) : undefined
            const note = e.pre_trade || e.post_trade || e.lessons || ""
            return (
              <li key={e.id} style={{ borderTop: "1px solid var(--c-border)", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {t && (
                    <span className={`chip ${t.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10.5 }}>
                      <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={11} />
                      <span className="mono">{t.pair}</span>
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{e.title ?? "Untitled"}</span>
                  {e.mood && <span className="chip" style={{ fontSize: 10.5 }}>{e.mood}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-fg-dim)" }}>
                    {new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                {note && (
                  <p style={{
                    margin: 0,
                    fontSize: 12.5, color: "var(--c-fg-muted)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {note}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
