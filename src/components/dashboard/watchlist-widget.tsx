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
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {pairs.slice(0, 6).map((p) => {
            const tone = p.bias === "long" ? "var(--c-green-bright)" : p.bias === "short" ? "var(--c-red-bright)" : "var(--c-fg-muted)"
            return (
              <li key={p.id} style={{ borderTop: "1px solid var(--c-border)", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <PairFlag pair={p.pair} size={18} />
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{p.pair}</span>
                <span style={{ fontSize: 11, color: tone, textTransform: "capitalize" }}>{p.bias}</span>
                {p.setup_note && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-fg-dim)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.setup_note}
                  </span>
                )}
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
      )}
    </div>
  )
}
