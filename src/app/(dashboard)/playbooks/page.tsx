import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getPlaybooksWithStats } from "@/lib/queries/playbooks"
import { getUserTrades } from "@/lib/queries/trades"
import { formatUSD } from "@/lib/finance"
import { PlaybookCard } from "@/components/playbooks/playbook-card"
import { AddPlaybookButton, StarterTemplates } from "@/components/playbooks/add-playbook-buttons"

export default async function PlaybooksPage() {
  const m = SECTION_META.playbooks
  const [playbooks, trades] = await Promise.all([
    getPlaybooksWithStats(),
    getUserTrades({ limit: 5000 }),
  ])

  if (playbooks.length === 0) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={<AddPlaybookButton />}
        />
        <SectionStub
          icon={m.icon}
          title="No playbooks defined"
          description="A playbook documents one setup — rules, invalidations, target R, pairs, sessions. Tag trades with a playbook and stats populate automatically. Start from a template below or create your own."
        />
        <StarterTemplates existingNames={new Set()} />
      </>
    )
  }

  const totals = {
    active: playbooks.filter((p) => p.status === "active").length,
    review: playbooks.filter((p) => p.status === "review").length,
    draft: playbooks.filter((p) => p.status === "draft").length,
  }
  const totalPnl = playbooks.reduce((s, p) => s + p.stats.totalPnL, 0)
  const totalTrades = playbooks.reduce((s, p) => s + p.stats.trades, 0)
  const closedTotal = playbooks.reduce((s, p) => s + p.stats.closedTrades, 0)
  const sumWeightedWR = playbooks.reduce((s, p) => s + (p.stats.winRate ?? 0) * p.stats.closedTrades, 0)
  const avgWinRate = closedTotal > 0 ? Math.round(sumWeightedWR / closedTotal) : 0
  const bestPb = [...playbooks].sort((a, b) => (b.stats.expectancy ?? -999) - (a.stats.expectancy ?? -999))[0]

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${playbooks.length} playbook${playbooks.length === 1 ? "" : "s"} · ${totalTrades} trade${totalTrades === 1 ? "" : "s"} documented`}
        actions={
          <>
            <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
              <Icon name="external" size={13} /> <span>Import template</span>
            </button>
            <AddPlaybookButton />
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <KpiCard label="Net from Playbooks" value={closedTotal > 0 ? formatUSD(totalPnl, { signed: true }) : "—"} sub="across all setups" color={totalPnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
        <KpiCard label="Avg Win Rate" value={closedTotal > 0 ? `${avgWinRate}%` : "—"} sub="weighted by trade count" />
        <TopPlaybookCard pb={bestPb} />
        <StatusCard totals={totals} />
      </div>

      <PlaybooksFilterAndGrid playbooks={playbooks} trades={trades} totals={totals} />
    </>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 1 }}>{sub}</div>
    </div>
  )
}

function TopPlaybookCard({ pb }: { pb: { name: string; color: string; stats: { expectancy: number | null } } | undefined }) {
  if (!pb) return <KpiCard label="Top Playbook" value="—" sub="no playbooks yet" />
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Playbook</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span style={{ width: 8, height: 22, borderRadius: 2, background: pb.color }} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{pb.name}</span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 4 }}>
        {pb.stats.expectancy != null ? `${pb.stats.expectancy > 0 ? "+" : ""}${pb.stats.expectancy}R expectancy` : "no data"}
      </div>
    </div>
  )
}

function StatusCard({ totals }: { totals: { active: number; review: number; draft: number } }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "baseline", flexWrap: "wrap" }}>
        <div><span className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--c-green-bright)" }}>{totals.active}</span> <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>active</span></div>
        <div><span className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--c-amber)" }}>{totals.review}</span> <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>review</span></div>
        <div><span className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--c-fg-muted)" }}>{totals.draft}</span> <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>draft</span></div>
      </div>
    </div>
  )
}

function PlaybooksFilterAndGrid(props: Parameters<typeof PlaybooksFilterAndGridImpl>[0]) {
  return <PlaybooksFilterAndGridImpl {...props} />
}

// Move inline so we can keep page as server component (re-import as client below).
import { PlaybooksFilterAndGridImpl } from "@/components/playbooks/playbooks-grid"
