import Link from "next/link"
import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getUserAccounts } from "@/lib/queries/accounts"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function startOfMonthIso() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}
function startOfYearIso() {
  const d = new Date()
  d.setMonth(0, 1)
  return d.toISOString().slice(0, 10)
}
function currentMonthLabel() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

export default async function ReportsPage() {
  const m = SECTION_META.reports
  const accounts = await getUserAccounts()

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle="Tax-ready CSV exports + monthly summary printouts. Real PDF rendering and prop-firm progress reports come in Phase 10."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
        {/* Trades CSV */}
        <ReportCard
          icon="reports"
          title="Trade history (CSV)"
          description="Every trade — opened, closed, account, P&L, R, tags, notes. Tax-software friendly."
          action="/api/reports/trades"
          download
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="From">
              <input name="from" type="date" defaultValue={startOfYearIso()} style={input} />
            </Field>
            <Field label="To">
              <input name="to" type="date" defaultValue={todayIso()} style={input} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Account">
              <select name="account" defaultValue="all" style={input}>
                <option value="all">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.broker} · {a.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue="all" style={input}>
                <option value="all">All</option>
                <option value="closed">Closed only</option>
                <option value="open">Open only</option>
              </select>
            </Field>
          </div>
        </ReportCard>

        {/* Journal CSV */}
        <ReportCard
          icon="journal"
          title="Journal entries (CSV)"
          description="Every entry across all 6 fields plus rule-break flags. Useful for retrospective reviews."
          action="/api/reports/journal"
          download
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="From">
              <input name="from" type="date" defaultValue={startOfMonthIso()} style={input} />
            </Field>
            <Field label="To">
              <input name="to" type="date" defaultValue={todayIso()} style={input} />
            </Field>
          </div>
        </ReportCard>

        {/* Monthly summary print view */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CardHeader icon="analytics" title="Monthly summary" description="Print-friendly recap with KPIs, equity curve, and a trade list. Save as PDF from your browser." />
          <form method="get" action="/reports/monthly" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <Field label="Month">
              <input name="month" type="month" defaultValue={currentMonthLabel()} required style={{ ...input, width: 160 }} />
            </Field>
            <button type="submit" className="btn btn-primary">
              <Icon name="external" size={13} /> <span>Open</span>
            </button>
          </form>
        </div>

        {/* Coming soon */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.7 }}>
          <CardHeader
            icon="risk"
            title="Prop firm progress (coming soon)"
            description="Day-by-day equity vs. firm rules: drawdown remaining, profit target progress, days remaining. Phase 10."
          />
          <span className="chip" style={{ alignSelf: "flex-start", fontSize: 10.5 }}>Roadmap</span>
        </div>
      </div>
    </>
  )
}

function ReportCard({
  icon, title, description, action, download, children,
}: {
  icon: "reports" | "journal" | "analytics"
  title: string
  description: string
  action: string
  download?: boolean
  children: React.ReactNode
}) {
  return (
    <form method="get" action={action} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CardHeader icon={icon} title={title} description={description} />
      {children}
      <button type="submit" className="btn btn-primary" style={{ marginTop: 4, alignSelf: "flex-start" }}>
        <Icon name="external" size={13} />
        <span>{download ? "Download CSV" : "Open"}</span>
      </button>
    </form>
  )
}

function CardHeader({ icon, title, description }: { icon: "reports" | "journal" | "analytics" | "risk"; title: string; description: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: "var(--c-bg-elev-3)",
        display: "grid", placeItems: "center",
        color: "var(--c-fg-muted)", flexShrink: 0,
      }}>
        <Icon name={icon} size={17} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h3 className="card-title" style={{ fontSize: 14 }}>{title}</h3>
        <p className="card-subtitle" style={{ marginTop: 2, lineHeight: 1.4 }}>{description}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 12.5,
  outline: "none",
  width: "100%",
  fontFamily: "var(--font-mono)",
}

// Use unused imports defensively in case icon set narrows.
export const _link = Link
