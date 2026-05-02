import Link from "next/link"
import { Icon, PairFlag } from "@/components/icons"
import { getWatchlist } from "@/lib/queries/watchlist"

export async function WatchlistWidget() {
  const pairs = await getWatchlist()

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Watchlist</h3>
          <p className="card-subtitle">{pairs.length === 0 ? "No pairs yet" : `${pairs.length} pair${pairs.length === 1 ? "" : "s"}`}</p>
        </div>
        <Link href="/watchlist" className="btn" style={{ fontSize: 12 }}>Manage</Link>
      </div>

      {pairs.length === 0 ? (
        <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 12.5, lineHeight: 1.5 }}>
          Track pairs to focus your morning routine. <Link href="/watchlist" style={{ color: "var(--c-accent-bright)" }}>Add some →</Link>
        </div>
      ) : (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 12px",
            padding: "8px 18px",
            fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
            borderBottom: "1px solid var(--c-border)",
          }}>
            <span>Pair / Bias</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>24h</span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pairs.slice(0, 6).map((p) => {
              const tone = p.bias === "long" ? "var(--c-green-bright)" : p.bias === "short" ? "var(--c-red-bright)" : "var(--c-fg-muted)"
              return (
                <li key={p.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto",
                  gap: "6px 12px",
                  padding: "10px 18px",
                  borderTop: "1px solid var(--c-border)",
                  alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <PairFlag pair={p.pair} size={16} />
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.pair}</div>
                      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <span style={{ color: tone, textTransform: "capitalize" }}>{p.bias}</span>
                        {p.setup_note && (
                          <>
                            <span style={{ margin: "0 4px", color: "var(--c-fg-dim)" }}>·</span>
                            {p.setup_note}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="tnum" style={{ fontSize: 12, color: "var(--c-fg-dim)", textAlign: "right", fontFamily: "var(--font-mono)" }}>—</span>
                  <span className="tnum" style={{ fontSize: 11.5, color: "var(--c-fg-dim)", textAlign: "right", fontFamily: "var(--font-mono)" }}>—</span>
                </li>
              )
            })}
            {pairs.length > 6 && (
              <li style={{ borderTop: "1px solid var(--c-border)", padding: "8px 18px", textAlign: "center" }}>
                <Link href="/watchlist" style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span>+ {pairs.length - 6} more</span>
                  <Icon name="chevronRight" size={11} />
                </Link>
              </li>
            )}
          </ul>
          <div style={{ padding: "8px 18px", fontSize: 10, color: "var(--c-fg-dim)", borderTop: "1px solid var(--c-border)" }}>
            Live prices wire up in Phase 9.
          </div>
        </>
      )}
    </div>
  )
}
