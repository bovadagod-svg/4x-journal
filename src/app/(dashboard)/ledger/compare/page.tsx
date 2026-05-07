import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getTradeDetail } from "@/lib/actions/trades"
import { Icon, PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { SectionHeader } from "@/components/shell/section-header"

/**
 * Trade comparison view. Renders 2–4 selected trades as side-by-side columns
 * — same row labels (P&L, R, entry, exit, fills, journal) so the eye reads
 * across. Useful for "why did this win and that lose?" reflection.
 *
 * Reached by selecting trades on /ledger and hitting the Compare button in
 * the multi-select bar.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ trades?: string }>
}) {
  const { trades: tradesParam } = await searchParams
  const ids = (tradesParam ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4)
  if (ids.length < 2) {
    redirect("/ledger")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const details = await Promise.all(ids.map((id) => getTradeDetail(id)))
  const filtered = details.filter((d): d is NonNullable<typeof d> => d !== null)
  if (filtered.length < 2) notFound()

  // Pull linked journal entries (most recent per trade) in parallel.
  const entries = await Promise.all(
    filtered.map(async (d) => {
      const { data } = await supabase
        .from("journal_entries")
        .select("pre_trade, post_trade, mood, mistakes, rule_break, rule_break_tags, tags")
        .eq("trade_id", d.trade.id)
        .order("last_edited_at", { ascending: false })
        .limit(1)
      return data?.[0] ?? null
    }),
  )

  return (
    <>
      <SectionHeader
        title="Compare trades"
        subtitle={`${filtered.length} side by side · same row labels — read across, not down`}
        actions={
          <Link href="/ledger" className="btn">
            <Icon name="chevronRight" size={12} style={{ transform: "rotate(180deg)" }} /> <span>Back to ledger</span>
          </Link>
        }
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: `160px repeat(${filtered.length}, minmax(220px, 1fr))`,
        gap: 0,
        background: "var(--c-bg-elev-1)",
        border: "1px solid var(--c-border)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={hCell}></div>
        {filtered.map((d, i) => (
          <div key={d.trade.id} style={{ ...hCell, borderLeft: "1px solid var(--c-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <PairFlag pair={d.trade.pair} size={20} />
              <Link href={`/trades/${d.trade.id}/print`} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--c-fg)", textDecoration: "none" }}>
                {d.trade.pair}
              </Link>
              <span className={"chip " + (d.trade.side === "long" ? "chip-green" : "chip-red")} style={{ fontSize: 9.5, padding: "1px 6px", marginLeft: "auto" }}>
                {d.trade.side === "long" ? "L" : "S"}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>
              #{i + 1} · {d.trade.opened_at ? new Date(d.trade.opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </div>
          </div>
        ))}

        {/* P&L row — the headline */}
        <Row label="P&L" />
        {filtered.map((d) => {
          const pnl = d.trade.pnl != null ? Number(d.trade.pnl) : null
          return (
            <Cell key={d.trade.id}>
              <strong className="tnum" style={{
                fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600,
                color: pnl == null ? "var(--c-fg-muted)" : pnl > 0 ? "var(--c-green-bright)" : pnl < 0 ? "var(--c-red-bright)" : "var(--c-fg)",
              }}>
                {pnl != null ? formatUSD(pnl, { signed: true }) : "—"}
              </strong>
            </Cell>
          )
        })}

        <Row label="R" />
        {filtered.map((d) => {
          const r = d.trade.r != null ? Number(d.trade.r) : null
          return (
            <Cell key={d.trade.id}>
              <span className="tnum" style={{ fontSize: 16, fontWeight: 600, color: r == null ? "var(--c-fg-muted)" : r > 0 ? "var(--c-green-bright)" : r < 0 ? "var(--c-red-bright)" : "var(--c-fg)" }}>
                {r != null ? `${r > 0 ? "+" : ""}${r.toFixed(2)}R` : "—"}
              </span>
            </Cell>
          )
        })}

        <Row label="Account" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
              {d.account ? `${d.account.broker} · ${d.account.label}` : "—"}
            </span>
          </Cell>
        ))}

        <Row label="Setup" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            {d.playbook ? (
              <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: d.playbook.color }} />
                {d.playbook.name}
              </span>
            ) : <span style={{ fontSize: 12, color: "var(--c-fg-dim)" }}>—</span>}
          </Cell>
        ))}

        <Row label="Status" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="chip" style={{ fontSize: 10, padding: "1px 7px", textTransform: "uppercase" }}>
              {d.trade.status}
            </span>
          </Cell>
        ))}

        <Row label="Entry" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="tnum" style={{ fontSize: 12 }}>{Number(d.trade.entry_price).toFixed(5)}</span>
          </Cell>
        ))}

        <Row label="Exit" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="tnum" style={{ fontSize: 12 }}>{d.trade.exit_price != null ? Number(d.trade.exit_price).toFixed(5) : "—"}</span>
          </Cell>
        ))}

        <Row label="Stop" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="tnum" style={{ fontSize: 12, color: "var(--c-red-bright)" }}>
              {d.trade.stop_price != null ? Number(d.trade.stop_price).toFixed(5) : "—"}
            </span>
          </Cell>
        ))}

        <Row label="Target" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="tnum" style={{ fontSize: 12, color: "var(--c-green-bright)" }}>
              {d.trade.target_price != null ? Number(d.trade.target_price).toFixed(5) : "—"}
            </span>
          </Cell>
        ))}

        <Row label="Risk" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="tnum" style={{ fontSize: 12 }}>
              {d.trade.risk_amount != null ? formatUSD(Number(d.trade.risk_amount)) : "—"}
            </span>
          </Cell>
        ))}

        <Row label="Hold time" />
        {filtered.map((d) => (
          <Cell key={d.trade.id}>
            <span className="tnum" style={{ fontSize: 12 }}>{formatHold(d.trade.opened_at, d.trade.closed_at)}</span>
          </Cell>
        ))}

        <Row label="Fills" />
        {filtered.map((d) => {
          const entry = d.fills.filter((f) => f.kind === "entry").length
          const exit = d.fills.filter((f) => f.kind === "exit").length
          return (
            <Cell key={d.trade.id}>
              <span style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
                {entry} entry · {exit} exit
              </span>
            </Cell>
          )
        })}

        <Row label="Mood" />
        {filtered.map((d, i) => (
          <Cell key={d.trade.id}>
            <span style={{ fontSize: 12 }}>{entries[i]?.mood ?? d.trade.mood ?? <span style={{ color: "var(--c-fg-dim)" }}>—</span>}</span>
          </Cell>
        ))}

        <Row label="Rule break" />
        {filtered.map((d, i) => (
          <Cell key={d.trade.id}>
            {entries[i]?.rule_break ? (
              <span className="chip chip-red" style={{ fontSize: 10, padding: "1px 7px" }}>
                {entries[i]!.rule_break_tags?.length ? entries[i]!.rule_break_tags!.join(", ") : "yes"}
              </span>
            ) : entries[i] ? (
              <span style={{ fontSize: 11.5, color: "var(--c-green-bright)" }}>clean</span>
            ) : (
              <span style={{ fontSize: 11.5, color: "var(--c-fg-dim)" }}>—</span>
            )}
          </Cell>
        ))}

        <Row label="Pre-trade thesis" />
        {filtered.map((d, i) => (
          <Cell key={d.trade.id} multiline>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {entries[i]?.pre_trade?.trim() || <span style={{ color: "var(--c-fg-dim)" }}>—</span>}
            </p>
          </Cell>
        ))}

        <Row label="Post-trade review" />
        {filtered.map((d, i) => (
          <Cell key={d.trade.id} multiline>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {entries[i]?.post_trade?.trim() || <span style={{ color: "var(--c-fg-dim)" }}>—</span>}
            </p>
          </Cell>
        ))}

        <Row label="Mistakes" />
        {filtered.map((d, i) => (
          <Cell key={d.trade.id}>
            {entries[i]?.mistakes && entries[i]!.mistakes!.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {entries[i]!.mistakes!.map((m) => (
                  <span key={m} className="chip" style={{ fontSize: 10, padding: "1px 7px", background: "var(--c-bg-elev-2)", color: "var(--c-fg-muted)" }}>
                    {m}
                  </span>
                ))}
              </div>
            ) : <span style={{ fontSize: 11.5, color: "var(--c-fg-dim)" }}>—</span>}
          </Cell>
        ))}
      </div>
    </>
  )
}

function Row({ label }: { label: string }) {
  return (
    <div style={{
      padding: "12px 14px",
      fontSize: 10.5,
      color: "var(--c-fg-muted)",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      borderTop: "1px solid var(--c-border)",
      background: "var(--c-bg-elev-2)",
      display: "flex", alignItems: "center",
    }}>
      {label}
    </div>
  )
}

function Cell({ children, multiline }: { children: React.ReactNode; multiline?: boolean }) {
  return (
    <div style={{
      padding: multiline ? "12px 14px" : "12px 14px",
      borderTop: "1px solid var(--c-border)",
      borderLeft: "1px solid var(--c-border)",
      display: "flex", alignItems: multiline ? "flex-start" : "center",
      minHeight: multiline ? 64 : "auto",
    }}>
      {children}
    </div>
  )
}

const hCell: React.CSSProperties = {
  padding: "14px 14px 12px",
  background: "var(--c-bg-elev-2)",
}

function formatHold(opened: string | null, closed: string | null): string {
  if (!opened || !closed) return "—"
  const ms = new Date(closed).getTime() - new Date(opened).getTime()
  if (!Number.isFinite(ms) || ms < 0) return "—"
  const min = ms / 60000
  if (min < 60) return `${Math.round(min)}m`
  if (min < 1440) return `${(min / 60).toFixed(1)}h`
  return `${(min / 1440).toFixed(1)}d`
}
