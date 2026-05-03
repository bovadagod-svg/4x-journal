import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { Icon, type IconName } from "@/components/icons"
import { getUserAccounts } from "@/lib/queries/accounts"
import { createClient } from "@/lib/supabase/server"
import { formatUSD } from "@/lib/finance"

function todayIso() { return new Date().toISOString().slice(0, 10) }
function startOfMonthIso() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
function startOfYearIso() { const d = new Date(); d.setMonth(0, 1); return d.toISOString().slice(0, 10) }
function currentMonthLabel() { return new Date().toISOString().slice(0, 7) }

export default async function ReportsPage() {
  const m = SECTION_META.reports
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: settings } = user
    ? await supabase
        .from("user_settings")
        .select("tax_jurisdiction, tax_fx_election, tax_estimated_rate")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null }

  const [accounts, ytdStats] = await Promise.all([
    getUserAccounts(),
    getYtdStats(),
  ])
  const taxYear = new Date().getFullYear()
  const election = settings?.tax_fx_election ?? "988"
  const jurisdiction = settings?.tax_jurisdiction ?? "US"
  const taxRate = Number(settings?.tax_estimated_rate ?? 0.32)
  const afterTaxNet = ytdStats.netPnL > 0 ? ytdStats.netPnL * (1 - taxRate) : ytdStats.netPnL

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle="Tax-ready CSV exports and monthly print-ready summaries · PDFs and prop-firm reports arrive in Phase 10"
      />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Kpi
          label={`${taxYear} Net P&L`}
          value={ytdStats.trades > 0 ? formatUSD(ytdStats.netPnL, { signed: true }) : "—"}
          sub={ytdStats.trades > 0 ? `across ${accounts.length} account${accounts.length === 1 ? "" : "s"}` : "no closed trades yet"}
          color={ytdStats.netPnL > 0 ? "var(--c-green-bright)" : ytdStats.netPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"}
        />
        <Kpi
          label="Total Trades"
          value={String(ytdStats.trades)}
          sub={ytdStats.trades > 0 ? `${ytdStats.winRate}% win rate` : "log a trade to start"}
        />
        <Kpi
          label="Wins / Losses"
          value={ytdStats.trades > 0 ? `${ytdStats.wins} / ${ytdStats.losses}` : "—"}
          sub={ytdStats.breakeven > 0 ? `${ytdStats.breakeven} breakeven` : "year-to-date"}
        />
        <Kpi
          label="Tax Year"
          value={String(taxYear)}
          sub={`filing due Apr 15, ${taxYear + 1}`}
          color="var(--c-amber)"
        />
      </div>

      {/* Generate New Report */}
      <div>
        <h3 style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Generate New Report</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {/* Trade CSV */}
          <ReportTile
            icon="reports"
            color="#11C458"
            title="Trade history (CSV)"
            description="Every trade — opened, closed, account, P&L, R, tags, notes. Tax-software friendly."
            badge="Most used"
          >
            <form method="get" action="/api/reports/trades" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <Icon name="external" size={13} />
                <span>Download CSV</span>
              </button>
            </form>
          </ReportTile>

          {/* Journal CSV */}
          <ReportTile
            icon="journal"
            color="#E5A23B"
            title="Journal entries (CSV)"
            description="All notes, mood, mistakes, lessons, rule-break flags. Useful for retrospective reviews."
          >
            <form method="get" action="/api/reports/journal" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="From">
                  <input name="from" type="date" defaultValue={startOfMonthIso()} style={input} />
                </Field>
                <Field label="To">
                  <input name="to" type="date" defaultValue={todayIso()} style={input} />
                </Field>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <Icon name="external" size={13} />
                <span>Download CSV</span>
              </button>
            </form>
          </ReportTile>

          {/* Monthly summary */}
          <ReportTile
            icon="analytics"
            color="#6932D4"
            title="Monthly summary"
            description="Print-friendly recap with KPIs, equity curve, and trade list. Save as PDF from your browser."
          >
            <form method="get" action="/reports/monthly" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Field label="Month">
                <input name="month" type="month" defaultValue={currentMonthLabel()} required style={{ ...input, width: 160 }} />
              </Field>
              <button type="submit" className="btn btn-primary">
                <Icon name="external" size={13} />
                <span>Open</span>
              </button>
            </form>
          </ReportTile>

          {/* Form 8949 (FIFO) */}
          <ReportTile
            icon="reports"
            color="#11C458"
            title="Form 8949 (FIFO)"
            description={
              election === "988"
                ? "IRS Form 8949 line items by tax lot — short/long-term split. Wash-sale flagging is off (Section 988 election)."
                : "IRS Form 8949 line items — short/long-term split, FIFO matching, wash-sale flagging on."
            }
            badge="Year-end"
          >
            <form method="get" action="/api/reports/form-8949" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Tax year">
                  <input name="year" type="number" min={2000} max={2100} step={1} defaultValue={taxYear} required style={input} />
                </Field>
                <Field label="Account">
                  <select name="account" defaultValue="all" style={input}>
                    <option value="all">All accounts</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.broker} · {a.label}</option>)}
                  </select>
                </Field>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <Icon name="external" size={13} />
                <span>Download CSV</span>
              </button>
            </form>
          </ReportTile>

          {/* Roadmap tiles */}
          <RoadmapTile icon="accounts" color="#4312A0" title="Prop Firm Statement" desc="FunderPro / FTMO compliant — daily DD, profit target, payouts." />
          <RoadmapTile icon="playbook" color="#BE333D" title="Playbook Audit" desc="Per-setup expectancy, win rate, sample trades and rule adherence." />
        </div>
      </div>

      {/* Tax Summary */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div>
            <h3 className="card-title">{taxYear} Tax Summary</h3>
            <p className="card-subtitle">
              Realized P&L · {jurisdiction === "US" ? `Section ${election} treatment` : `${jurisdiction} jurisdiction`} · as of {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href="/settings?tab=tax" className="btn">
              <Icon name="settings" size={13} />
              <span>Tax settings</span>
            </a>
            <a href={`/api/reports/trades?from=${taxYear}-01-01&to=${todayIso()}&account=all&status=closed`} className="btn btn-primary">
              <Icon name="external" size={13} />
              <span>Export tax CSV</span>
            </a>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
          <TaxStat label={election === "1256" ? "Realized gains" : "Short-term gains"} value={ytdStats.totalWinPnL > 0 ? formatUSD(ytdStats.totalWinPnL) : "—"} color="var(--c-green-bright)" />
          <TaxStat label={election === "1256" ? "Realized losses" : "Short-term losses"} value={ytdStats.totalLossPnL < 0 ? formatUSD(ytdStats.totalLossPnL) : "—"} color="var(--c-red-bright)" />
          <TaxStat label="Net realized" value={ytdStats.trades > 0 ? formatUSD(ytdStats.netPnL, { signed: true }) : "—"} color={ytdStats.netPnL >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
          <TaxStat
            label={`Est. after-tax (${Math.round(taxRate * 100)}%)`}
            value={ytdStats.trades > 0 ? formatUSD(afterTaxNet, { signed: true }) : "—"}
            color={afterTaxNet >= 0 ? "var(--c-fg)" : "var(--c-red-bright)"}
          />
        </div>
        <div style={{ padding: 12, background: "rgba(105, 50, 212, 0.08)", border: "1px solid rgba(105, 50, 212, 0.2)", borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Icon name="info" size={14} color="var(--c-purple-bright)" />
          <span>
            {jurisdiction === "US" && election === "988" && "Section 988 (ordinary-income) treatment applied. Switch to Section 1256 60/40 in Settings → Tax if you've made the election."}
            {jurisdiction === "US" && election === "1256" && "Section 1256 60/40 split applied (60% long-term, 40% short-term). Year-end mark-to-market — your accountant will need this CSV."}
            {jurisdiction !== "US" && `Reports use your ${jurisdiction} jurisdiction. Wash-sale matching is your tax software's job.`}
          </span>
        </div>
      </div>
    </>
  )
}

async function getYtdStats() {
  const supabase = await createClient()
  const yearStart = new Date(); yearStart.setMonth(0, 1); yearStart.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from("trades")
    .select("pnl, status")
    .gte("opened_at", yearStart.toISOString())
  const all = data ?? []
  const closed = all.filter((t) => t.status === "closed")
  const wins = closed.filter((t) => Number(t.pnl) > 0)
  const losses = closed.filter((t) => Number(t.pnl) < 0)
  const breakeven = closed.length - wins.length - losses.length
  const totalWinPnL = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const totalLossPnL = losses.reduce((s, t) => s + Number(t.pnl), 0)
  const netPnL = totalWinPnL + totalLossPnL
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0
  return {
    trades: all.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    totalWinPnL: Number(totalWinPnL.toFixed(2)),
    totalLossPnL: Number(totalLossPnL.toFixed(2)),
    netPnL: Number(netPnL.toFixed(2)),
    winRate,
  }
}

function ReportTile({
  icon, color, title, description, badge, children,
}: {
  icon: IconName
  color: string
  title: string
  description: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${color}22`, border: `1px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name={icon} size={17} color={color} />
        </div>
        {badge && <span className="chip chip-purple" style={{ fontSize: 10 }}>{badge}</span>}
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginTop: 3, lineHeight: 1.45 }}>{description}</div>
      </div>
      {children}
    </div>
  )
}

function RoadmapTile({ icon, color, title, desc }: { icon: IconName; color: string; title: string; desc: string }) {
  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, opacity: 0.55 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${color}22`, border: `1px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name={icon} size={17} color={color} />
        </div>
        <span className="chip" style={{ fontSize: 10 }}>Roadmap</span>
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
      </div>
      <button disabled className="btn" style={{ alignSelf: "flex-start", opacity: 0.5, cursor: "not-allowed" }}>
        <Icon name="external" size={13} />
        <span>Coming soon</span>
      </button>
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function TaxStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", padding: 12, borderRadius: 8, border: "1px solid var(--c-border)" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 18, fontWeight: 600, color, fontFamily: "var(--font-display)", marginTop: 2 }}>{value}</div>
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
