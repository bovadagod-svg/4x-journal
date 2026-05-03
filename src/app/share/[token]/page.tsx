import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Icon } from "@/components/icons"

export const metadata = { title: "Shared entry · 4x Journal" }

export default async function SharedEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: rows } = await supabase.rpc("get_entry_by_share_token", { p_token: token })
  const entry = rows?.[0] ?? null
  if (!entry) notFound()

  const ownerName = entry.display_name ?? (entry.handle ? `@${entry.handle}` : "A 4x Journal trader")

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--c-bg)",
      padding: "32px 18px",
      display: "flex", justifyContent: "center",
    }}>
      <div style={{ width: "min(720px, 100%)", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--c-fg-muted)", textDecoration: "none" }}>
            <Icon name="logo" size={20} color="var(--c-purple-bright)" />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--c-fg)" }}>4x Journal</span>
          </Link>
          <Link href="/login" className="btn">Sign in</Link>
        </div>

        {/* Hero */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: 8 }}>
            Shared by {ownerName}
          </div>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {entry.trade_pair && (
                <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{entry.trade_pair}</span>
              )}
              {entry.trade_side && (
                <span className={`chip ${entry.trade_side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10 }}>
                  {entry.trade_side.toUpperCase()}
                </span>
              )}
              {entry.title && (
                <span style={{ fontSize: 14, fontWeight: 500 }}>{entry.title}</span>
              )}
            </div>
            {entry.trade_r != null && (
              <span className="tnum" style={{
                fontSize: 14, fontWeight: 600,
                color: Number(entry.trade_r) >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
              }}>
                {Number(entry.trade_r) >= 0 ? "+" : ""}{Number(entry.trade_r).toFixed(2)}R
              </span>
            )}
          </header>

          {entry.pre_trade && <EntrySection label="Pre-trade thesis" body={entry.pre_trade} />}
          {entry.post_trade && <EntrySection label="Post-trade review" body={entry.post_trade} />}
          {entry.cold_review && <EntrySection label="Cold review" body={entry.cold_review} />}
          {entry.lessons && <EntrySection label="Lessons" body={entry.lessons} />}

          <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 11, color: "var(--c-fg-dim)", borderTop: "1px solid var(--c-border)", paddingTop: 10, marginTop: 14 }}>
            <span className="mono">
              {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            {entry.tags && entry.tags.length > 0 && (
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {entry.tags.slice(0, 6).map((t) => (
                  <span key={t} className="chip" style={{ fontSize: 9.5 }}>{t}</span>
                ))}
              </span>
            )}
          </footer>
        </div>

        {entry.handle && (
          <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--c-fg-muted)" }}>
            See more of <Link href={`/u/${entry.handle}`} style={{ color: "var(--c-purple-bright)" }}>{ownerName}</Link>’s public entries.
          </div>
        )}

        <div style={{ textAlign: "center", padding: "12px 0 8px", fontSize: 11.5, color: "var(--c-fg-dim)" }}>
          Powered by <Link href="/" style={{ color: "var(--c-purple-bright)" }}>4x Journal</Link>.
        </div>
      </div>
    </div>
  )
}

function EntrySection({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--c-fg)", whiteSpace: "pre-wrap" }}>{body}</p>
    </div>
  )
}
