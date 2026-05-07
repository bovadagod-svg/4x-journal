import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getTradeDetail } from "@/lib/actions/trades"
import { formatUSD } from "@/lib/finance"
import { Icon } from "@/components/icons"
import { PrintButton } from "@/components/trades/print-button"

/**
 * Print-friendly single-trade summary. Lives outside (dashboard) layout so the
 * sidebar + topbar drop out for a clean printed page.
 *
 * Use case: trader exports a trade as PDF for a coaching session, or attaches
 * it to a thread when asking for review. Captures everything the drawer shows
 * minus the interactive widgets (replay chart needs a Polygon round-trip;
 * skipped here so the printed page renders deterministically).
 */
export default async function TradePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params
  const detail = await getTradeDetail(id)
  if (!detail) notFound()
  const { trade, fills, account, playbook } = detail

  // Find the most recent journal entry linked to this trade.
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("trade_id", id)
    .order("last_edited_at", { ascending: false })
    .limit(1)
  const entry = entries?.[0] ?? null

  const entryFills = fills.filter((f) => f.kind === "entry")
  const exitFills = fills.filter((f) => f.kind === "exit")
  const totalCommission = fills.reduce((s, f) => s + (Number(f.commission) || 0), 0)
  const totalSwap = fills.reduce((s, f) => s + (Number(f.swap) || 0), 0)
  const lifecycle = Array.isArray(trade.lifecycle_events) ? (trade.lifecycle_events as Array<Record<string, unknown>>) : []

  const sideText = trade.side === "long" ? "LONG" : "SHORT"

  return (
    <div className="report-page" style={{ background: "var(--c-bg)", minHeight: "100vh", padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
      <style>{`
        @media print {
          @page { margin: 14mm; }
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .report-page { padding: 0 !important; background: white !important; max-width: none !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; background: white !important; break-inside: avoid; }
          .print-section { break-inside: avoid; }
          .print-pre { white-space: pre-wrap; word-break: break-word; }
        }
      `}</style>

      {/* Action bar — hidden on print */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link href="/ledger" className="btn">
          <Icon name="chevronRight" size={12} style={{ transform: "rotate(180deg)" }} /> <span>Back to ledger</span>
        </Link>
        <PrintButton />
      </div>

      {/* Title block */}
      <div className="card print-section" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {trade.pair} · {sideText}
            </h1>
            <div style={{ fontSize: 12, color: "var(--c-fg-muted)", marginTop: 4 }}>
              {account ? `${account.broker} · ${account.label}` : "—"}
              {playbook && <> · {playbook.name}</>}
              {" · "}
              <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{trade.status}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>Realized P&L</div>
            <div className="tnum" style={{
              fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em",
              color: trade.pnl == null ? "var(--c-fg-muted)" : Number(trade.pnl) > 0 ? "var(--c-green-bright)" : Number(trade.pnl) < 0 ? "var(--c-red-bright)" : "var(--c-fg)",
            }}>
              {trade.pnl != null ? formatUSD(Number(trade.pnl), { signed: true }) : "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
              {trade.r != null ? `${Number(trade.r) > 0 ? "+" : ""}${Number(trade.r).toFixed(2)}R` : "—"}
              {trade.risk_amount != null && <> · risk {formatUSD(Number(trade.risk_amount))}</>}
            </div>
          </div>
        </div>
      </div>

      {/* Order detail grid */}
      <div className="card print-section" style={{ padding: 18, marginBottom: 14 }}>
        <SectionHeader title="Order" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 10 }}>
          <Cell label="Entry price" value={Number(trade.entry_price).toFixed(5)} />
          <Cell label="Exit price" value={trade.exit_price != null ? Number(trade.exit_price).toFixed(5) : "—"} />
          <Cell label="Stop" value={trade.stop_price != null ? Number(trade.stop_price).toFixed(5) : "—"} />
          <Cell label="Target" value={trade.target_price != null ? Number(trade.target_price).toFixed(5) : "—"} />
          <Cell label="Size" value={Number(trade.size).toString()} />
          <Cell label="Opened" value={trade.opened_at ? new Date(trade.opened_at).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—"} />
          <Cell label="Closed" value={trade.closed_at ? new Date(trade.closed_at).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—"} />
          {totalCommission !== 0 && <Cell label="Commission" value={formatUSD(Math.abs(totalCommission))} />}
          {totalSwap !== 0 && <Cell label="Swap" value={formatUSD(totalSwap, { signed: true })} />}
        </div>
        {trade.tags && trade.tags.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--c-fg-muted)" }}>
            Tags: {trade.tags.join(", ")}
          </div>
        )}
        {trade.notes && (
          <p className="print-pre" style={{ marginTop: 10, fontSize: 12, color: "var(--c-fg)", lineHeight: 1.55 }}>{trade.notes}</p>
        )}
      </div>

      {/* Fills table */}
      {fills.length > 0 && (
        <div className="card print-section" style={{ padding: 18, marginBottom: 14 }}>
          <SectionHeader title={`Fills (${entryFills.length} entry · ${exitFills.length} exit)`} />
          <table style={{ width: "100%", marginTop: 10, fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--c-fg-muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={th}>When</th>
                <th style={th}>Kind</th>
                <th style={th}>Size</th>
                <th style={th}>Price</th>
                <th style={th}>Type</th>
                <th style={th}>Comm.</th>
              </tr>
            </thead>
            <tbody>
              {fills.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                  <td className="tnum" style={td}>{new Date(f.filled_at).toISOString().replace("T", " ").slice(0, 16)}</td>
                  <td style={td}>{f.kind}</td>
                  <td className="tnum" style={td}>{Number(f.size).toString()}</td>
                  <td className="tnum" style={td}>{Number(f.price).toFixed(5)}</td>
                  <td style={td}>{f.order_type ?? "—"}</td>
                  <td className="tnum" style={td}>{f.commission != null ? formatUSD(Number(f.commission)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lifecycle events */}
      {lifecycle.length > 0 && (
        <div className="card print-section" style={{ padding: 18, marginBottom: 14 }}>
          <SectionHeader title={`Lifecycle (${lifecycle.length} events)`} />
          <table style={{ width: "100%", marginTop: 10, fontSize: 11.5, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--c-fg-muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={th}>When</th>
                <th style={th}>Status</th>
                <th style={th}>Type</th>
                <th style={th}>SL</th>
                <th style={th}>TP</th>
                <th style={th}>Price</th>
              </tr>
            </thead>
            <tbody>
              {lifecycle.map((e, i) => {
                const evt = e as { occurredAt?: string; status?: string; type?: string; stopLoss?: number | null; takeProfit?: number | null; price?: number | null; filledPrice?: number | null }
                const ts = typeof evt.occurredAt === "string" ? evt.occurredAt : null
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--c-border)" }}>
                    <td className="tnum" style={td}>{ts ? new Date(ts).toISOString().replace("T", " ").slice(0, 16) : "—"}</td>
                    <td style={td}>{evt.status ?? "—"}</td>
                    <td style={td}>{evt.type ?? "—"}</td>
                    <td className="tnum" style={td}>{evt.stopLoss != null ? Number(evt.stopLoss).toFixed(5) : "—"}</td>
                    <td className="tnum" style={td}>{evt.takeProfit != null ? Number(evt.takeProfit).toFixed(5) : "—"}</td>
                    <td className="tnum" style={td}>{evt.filledPrice != null ? Number(evt.filledPrice).toFixed(5) : evt.price != null ? Number(evt.price).toFixed(5) : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Journal entry */}
      {entry && (
        <div className="card print-section" style={{ padding: 18, marginBottom: 14 }}>
          <SectionHeader title="Journal" />
          {entry.mood && <Cell label="Mood" value={entry.mood} />}
          {entry.pre_trade && <JournalSection title="Pre-trade" body={entry.pre_trade} />}
          {Array.isArray(entry.during_trade) && entry.during_trade.length > 0 && (
            <div className="print-section" style={{ marginTop: 12 }}>
              <SubsectionHeader title="During trade" />
              <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 12, color: "var(--c-fg)", lineHeight: 1.6 }}>
                {(entry.during_trade as Array<{ ts?: string; text?: string }>).map((n, i) => (
                  <li key={i} className="print-pre">
                    {n.ts && <span style={{ color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)", fontSize: 10.5, marginRight: 6 }}>{new Date(n.ts).toISOString().slice(11, 16)}</span>}
                    {n.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {entry.post_trade && <JournalSection title="Post-trade" body={entry.post_trade} />}
          {entry.cold_review && <JournalSection title="Cold review" body={entry.cold_review} />}
          {entry.lessons && <JournalSection title="Lessons" body={entry.lessons} />}
          {entry.mistakes && entry.mistakes.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--c-fg-muted)" }}>
              Mistakes: {entry.mistakes.join(", ")}
            </div>
          )}
          {entry.rule_break && entry.rule_break_tags && entry.rule_break_tags.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--c-red-bright)" }}>
              Rule breaks: {entry.rule_break_tags.join(", ")}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 10.5, color: "var(--c-fg-dim)", textAlign: "center" }}>
        4x Journal · printed {new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
}

function SubsectionHeader({ title }: { title: string }) {
  return <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{title}</div>
}

function JournalSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="print-section" style={{ marginTop: 12 }}>
      <SubsectionHeader title={title} />
      <p className="print-pre" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--c-fg)", lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 13, fontWeight: 500, marginTop: 2, color: "var(--c-fg)" }}>{value}</div>
    </div>
  )
}

const th: React.CSSProperties = { padding: "6px 8px 4px", fontWeight: 500 }
const td: React.CSSProperties = { padding: "5px 8px", color: "var(--c-fg)" }
