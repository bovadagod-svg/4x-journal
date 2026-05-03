import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"

export const metadata = { title: "Profile · 4x Journal" }

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const supabase = await createClient()

  const { data: profileRows } = await supabase.rpc("get_public_profile", { p_handle: handle })
  const profile = profileRows?.[0] ?? null
  if (!profile) notFound()

  const { data: entries } = await supabase.rpc("get_public_entries", {
    p_user_id: profile.user_id,
    p_limit: 20,
  })
  const publicEntries = entries ?? []

  const winRate = profile.trade_count > 0
    ? Math.round((profile.win_count / profile.trade_count) * 100)
    : null
  const initials = (profile.display_name?.trim() || profile.handle || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

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
        <div className="card" style={{ padding: 22, display: "flex", gap: 18, alignItems: "center" }}>
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              style={{
                width: 72, height: 72, borderRadius: "50%",
                objectFit: "cover", flexShrink: 0,
                border: "1px solid var(--c-border)",
              }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, #6932D4, #B79CFF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 600, color: "#fff", fontFamily: "var(--font-display)",
              flexShrink: 0,
            }}>{initials || "?"}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}>
              {profile.display_name ?? `@${profile.handle}`}
            </h1>
            {profile.handle && profile.display_name && (
              <div className="mono" style={{ fontSize: 12.5, color: "var(--c-fg-muted)", marginTop: 2 }}>
                @{profile.handle}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: "var(--c-fg-dim)", marginTop: 6 }}>
              Trader since {new Date(profile.joined_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <Stat label="Closed trades" value={String(profile.trade_count)} />
          <Stat label="Win rate" value={winRate != null ? `${winRate}%` : "—"} color={winRate != null && winRate >= 50 ? "var(--c-green-bright)" : undefined} />
          <Stat label="Wins / Losses" value={`${profile.win_count} / ${profile.loss_count}`} />
          <Stat
            label="Total P&L"
            value={profile.trade_count > 0 ? formatUSD(Number(profile.total_pnl), { signed: true }) : "—"}
            color={Number(profile.total_pnl) > 0 ? "var(--c-green-bright)" : Number(profile.total_pnl) < 0 ? "var(--c-red-bright)" : undefined}
          />
        </div>

        {/* Entries */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Public journal entries
          </h2>
          {publicEntries.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
              {profile.display_name ?? "This trader"} hasn&apos;t shared any entries yet.
            </div>
          ) : (
            publicEntries.map((e) => (
              <article key={e.id} className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {e.trade_pair && (
                      <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{e.trade_pair}</span>
                    )}
                    {e.trade_side && (
                      <span className={`chip ${e.trade_side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 9.5 }}>
                        {e.trade_side.toUpperCase()}
                      </span>
                    )}
                    {e.title && (
                      <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.title}
                      </span>
                    )}
                  </div>
                  {e.trade_r != null && (
                    <span className="tnum" style={{
                      fontSize: 12, fontWeight: 600,
                      color: Number(e.trade_r) >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
                    }}>
                      {Number(e.trade_r) >= 0 ? "+" : ""}{Number(e.trade_r).toFixed(2)}R
                    </span>
                  )}
                </header>
                {e.pre_trade && <Section label="Pre-trade thesis" body={e.pre_trade} />}
                {e.post_trade && <Section label="Post-trade review" body={e.post_trade} />}
                {e.cold_review && <Section label="Cold review" body={e.cold_review} />}
                {e.lessons && <Section label="Lessons" body={e.lessons} />}
                <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 11, color: "var(--c-fg-dim)", borderTop: "1px solid var(--c-border)", paddingTop: 8 }}>
                  <span className="mono">{new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {e.tags && e.tags.length > 0 && (
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {e.tags.slice(0, 4).map((t) => (
                        <span key={t} className="chip" style={{ fontSize: 9.5 }}>{t}</span>
                      ))}
                    </span>
                  )}
                </footer>
              </article>
            ))
          )}
        </div>

        <div style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 11.5, color: "var(--c-fg-dim)" }}>
          Powered by <Link href="/" style={{ color: "var(--c-purple-bright)" }}>4x Journal</Link>.
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--c-fg-muted)", whiteSpace: "pre-wrap" }}>{body}</p>
    </div>
  )
}
