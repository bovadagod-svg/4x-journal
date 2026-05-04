import Link from "next/link"
import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { GoalCard } from "@/components/goals/goal-card"
import { GoalHistory } from "@/components/goals/goal-history"
import {
  getUserGoals,
  getPeriodActuals,
  periodWindow,
  recentPeriods,
  PERIOD_LABELS,
  type GoalPeriod,
  type GoalRow,
  type PeriodActuals,
  type PeriodWindow,
} from "@/lib/queries/goals"

const PERIODS: GoalPeriod[] = ["weekly", "monthly", "quarterly"]
const HISTORY_LENGTHS: Record<GoalPeriod, number> = { weekly: 12, monthly: 12, quarterly: 8 }

function parsePeriodParam(s: string | null | undefined): GoalPeriod {
  if (s === "weekly" || s === "monthly" || s === "quarterly") return s
  return "monthly"
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const m = SECTION_META.goals
  const params = await searchParams
  const activePeriod = parsePeriodParam(params.period)

  const goals = await getUserGoals()
  const enabled = goals.filter((g) => g.enabled)

  if (enabled.length === 0) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={
            <Link href="/settings?tab=goals" className="btn btn-primary">
              <Icon name="plus" size={13} /><span>Set up goals</span>
            </Link>
          }
        />
        <SectionStub
          icon={m.icon}
          title="No goals yet"
          description="Goals are how you turn 'I want to be a better trader' into something measurable. Open Settings → Goals to set a weekly P&L target, monthly win rate target, quarterly drawdown cap — whatever matters most to you."
        />
      </>
    )
  }

  const goalsForActivePeriod = enabled.filter((g) => g.period === activePeriod)
  const currentWindow = periodWindow(activePeriod)
  const currentActuals = await getPeriodActuals(currentWindow)

  // Build the history table data — fetch actuals for the past N windows.
  const history = recentPeriods(activePeriod, HISTORY_LENGTHS[activePeriod])
  const actualsByKey = new Map<string, PeriodActuals>()
  // Sequential fetch (one query per window) — these aren't huge but if we
  // see lots of users with months of data we can swap in a single bulk query.
  for (const w of history) {
    actualsByKey.set(w.key, await getPeriodActuals(w))
  }

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={m.subtitle}
        actions={
          <>
            <PeriodTabs active={activePeriod} />
            <Link href="/settings?tab=goals" className="btn">
              <Icon name="settings" size={13} /><span>Manage</span>
            </Link>
          </>
        }
      />

      {goalsForActivePeriod.length === 0 ? (
        <SectionStub
          icon={m.icon}
          title={`No ${activePeriod} goals`}
          description={`Switch to a different period above, or open Settings → Goals to add a ${activePeriod} target.`}
        />
      ) : (
        <>
          {/* Active goal cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 14 }}>
            {goalsForActivePeriod.map((g) => (
              <GoalCard key={g.id} goal={g} actuals={currentActuals} window={currentWindow} />
            ))}
          </div>

          {/* History tables — one per goal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {goalsForActivePeriod.map((g) => (
              <GoalHistory
                key={`hist-${g.id}`}
                goal={g}
                periods={history}
                actualsByKey={actualsByKey}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function PeriodTabs({ active }: { active: GoalPeriod }) {
  return (
    <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={p === "monthly" ? "/goals" : `/goals?period=${p}`}
          className={`tab ${p === active ? "active" : ""}`}
          style={{ padding: "5px 12px", fontSize: 12 }}
        >
          {PERIOD_LABELS[p]}
        </Link>
      ))}
    </div>
  )
}
