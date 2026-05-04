"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { upsertGoal, deleteGoal, toggleGoal } from "@/lib/actions/goals"
import {
  GOAL_METRICS,
  PERIOD_LABELS,
  type GoalMetric,
  type GoalPeriod,
  type GoalRow,
} from "@/lib/goals/metadata"
import { SettingsSection, SettingsRow, inputStyle } from "./settings-primitives"

const PERIODS: GoalPeriod[] = ["weekly", "monthly", "quarterly"]

export function GoalsPanel({ initial }: { initial: GoalRow[] }) {
  const router = useRouter()
  const [goals, setGoals] = useState<GoalRow[]>(initial)
  const [pending, start] = useTransition()
  const [drafts, setDrafts] = useState<Record<string, string>>({})  // local edits to target_value, keyed by goal id
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // New-goal form state
  const [newPeriod, setNewPeriod] = useState<GoalPeriod>("monthly")
  const [newMetric, setNewMetric] = useState<GoalMetric>("pnl_pct")
  const [newTarget, setNewTarget] = useState("")

  const refresh = () => {
    start(async () => {
      router.refresh()
    })
  }

  const onAdd = () => {
    if (!newTarget) { setErrorMsg("Enter a target value."); return }
    setErrorMsg(null)
    start(async () => {
      const r = await upsertGoal({
        period: newPeriod,
        metric: newMetric,
        target_value: Number(newTarget),
        enabled: true,
      })
      if (!r.ok) {
        setErrorMsg(r.error)
        return
      }
      setNewTarget("")
      router.refresh()
    })
  }

  const onSaveTarget = (g: GoalRow) => {
    const draft = drafts[g.id]
    if (draft == null) return
    const value = Number(draft)
    if (!Number.isFinite(value)) { setErrorMsg("Target must be a number."); return }
    setErrorMsg(null)
    start(async () => {
      const r = await upsertGoal({ id: g.id, period: g.period as GoalPeriod, metric: g.metric as GoalMetric, target_value: value, enabled: g.enabled })
      if (!r.ok) { setErrorMsg(r.error); return }
      setGoals((arr) => arr.map((x) => x.id === g.id ? { ...x, target_value: value } : x))
      setDrafts((d) => { const n = { ...d }; delete n[g.id]; return n })
      router.refresh()
    })
  }

  const onToggle = (g: GoalRow) => {
    setGoals((arr) => arr.map((x) => x.id === g.id ? { ...x, enabled: !x.enabled } : x))
    start(async () => {
      const r = await toggleGoal(g.id, !g.enabled)
      if (!r.ok) {
        setErrorMsg(r.error ?? "Failed to update")
        // Roll back optimistic update
        setGoals((arr) => arr.map((x) => x.id === g.id ? { ...x, enabled: g.enabled } : x))
      }
      router.refresh()
    })
  }

  const onDelete = (g: GoalRow) => {
    if (!confirm("Delete this goal?")) return
    setGoals((arr) => arr.filter((x) => x.id !== g.id))
    start(async () => {
      const r = await deleteGoal(g.id)
      if (!r.ok) {
        setErrorMsg(r.error ?? "Failed to delete")
        setGoals((arr) => [...arr, g].sort((a, b) => a.period.localeCompare(b.period)))
      }
      router.refresh()
    })
  }

  const groupedByPeriod: Record<GoalPeriod, GoalRow[]> = {
    weekly: goals.filter((g) => g.period === "weekly"),
    monthly: goals.filter((g) => g.period === "monthly"),
    quarterly: goals.filter((g) => g.period === "quarterly"),
  }

  // Metrics already used at the new-goal form's selected period — gray out so users
  // don't try to create duplicates that conflict with the unique constraint.
  const usedAtNewPeriod = new Set(
    goals.filter((g) => g.period === newPeriod && g.enabled).map((g) => g.metric),
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SettingsSection icon="target" title="Goals" subtitle="What success looks like for you, by period">
        <div style={{ padding: "0 0 14px", borderBottom: "1px solid var(--c-border)", marginBottom: 8 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
            Add as many goals as you want — one of each kind per period. Goals appear on the
            <a href="/goals" style={{ color: "var(--c-purple-bright)", marginLeft: 4 }}>Goals page</a> with
            progress bars and a history table.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px auto", gap: 8, alignItems: "flex-end" }}>
            <label style={fieldLabel}>
              <span style={fieldLabelText}>Period</span>
              <select value={newPeriod} onChange={(e) => setNewPeriod(e.target.value as GoalPeriod)} style={selectStyle}>
                {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </select>
            </label>
            <label style={fieldLabel}>
              <span style={fieldLabelText}>Metric</span>
              <select value={newMetric} onChange={(e) => setNewMetric(e.target.value as GoalMetric)} style={selectStyle}>
                {GOAL_METRICS.map((m) => (
                  <option key={m.metric} value={m.metric} disabled={usedAtNewPeriod.has(m.metric)}>
                    {m.label}{usedAtNewPeriod.has(m.metric) ? " (already set)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabel}>
              <span style={fieldLabelText}>Target</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number" step="any"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder={metricPlaceholder(newMetric)}
                  style={{ ...inputStyle, width: "100%" }}
                />
                <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>{metricUnit(newMetric)}</span>
              </div>
            </label>
            <button onClick={onAdd} disabled={pending} className="btn btn-primary" style={{ height: 34 }}>
              <Icon name="plus" size={11} /><span>Add</span>
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--c-fg-dim)" }}>
            {GOAL_METRICS.find((m) => m.metric === newMetric)?.description}
          </div>
        </div>

        {goals.length === 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--c-fg-muted)" }}>
            No goals yet. Add one above — start with a monthly P&amp;L target and add more as you build the habit.
          </p>
        ) : (
          PERIODS.map((p) => groupedByPeriod[p].length > 0 ? (
            <div key={p} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--c-fg-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {PERIOD_LABELS[p]}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {groupedByPeriod[p].map((g) => {
                  const meta = GOAL_METRICS.find((m) => m.metric === g.metric)
                  const draft = drafts[g.id]
                  const isDirty = draft != null && draft !== String(g.target_value)
                  return (
                    <div
                      key={g.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 130px auto auto",
                        gap: 8, alignItems: "center",
                        padding: "8px 10px",
                        background: g.enabled ? "var(--c-bg-elev-2)" : "var(--c-bg-elev-1)",
                        border: "1px solid var(--c-border)",
                        borderRadius: 8,
                        opacity: g.enabled ? 1 : 0.55,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{meta?.label ?? g.metric}</div>
                        <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 1 }}>
                          {meta?.direction === "lower" ? "cap, ≤ target" : "target, ≥ target"} · {meta?.unit ?? ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number" step="any"
                          defaultValue={String(g.target_value)}
                          onChange={(e) => setDrafts((d) => ({ ...d, [g.id]: e.target.value }))}
                          style={{ ...inputStyle, width: "100%", textAlign: "right" }}
                        />
                        <span style={{ fontSize: 11, color: "var(--c-fg-dim)", minWidth: 32 }}>{metricUnit(g.metric as GoalMetric)}</span>
                      </div>
                      {isDirty ? (
                        <button onClick={() => onSaveTarget(g)} className="btn btn-primary" disabled={pending} style={{ fontSize: 10.5, padding: "4px 8px" }}>
                          <Icon name="check" size={10} /> <span>Save</span>
                        </button>
                      ) : (
                        <button onClick={() => onToggle(g)} className="btn" disabled={pending} style={{ fontSize: 10.5, padding: "4px 8px" }} title={g.enabled ? "Disable" : "Enable"}>
                          <Icon name={g.enabled ? "check" : "x"} size={10} />
                          <span>{g.enabled ? "Active" : "Disabled"}</span>
                        </button>
                      )}
                      <button onClick={() => onDelete(g)} className="btn" disabled={pending} title="Delete goal" style={{ fontSize: 10.5, padding: "4px 8px", color: "var(--c-red-bright)", borderColor: "rgba(190, 51, 61, 0.3)" }}>
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null)
        )}

        {errorMsg && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--c-red-bright)" }}>{errorMsg}</div>
        )}
      </SettingsSection>
    </div>
  )
}

function metricUnit(metric: GoalMetric): string {
  const meta = GOAL_METRICS.find((m) => m.metric === metric)
  if (!meta) return ""
  return meta.unit === "$" ? "$" : meta.unit
}

function metricPlaceholder(metric: GoalMetric): string {
  switch (metric) {
    case "pnl_pct":            return "10"
    case "pnl_dollars":        return "1000"
    case "win_rate":           return "55"
    case "avg_r":              return "0.5"
    case "avg_pips":           return "20"
    case "profit_factor":      return "1.5"
    case "rules_followed_pct": return "90"
    case "max_rule_breaks":    return "2"
    case "max_drawdown_pct":   return "10"
    case "min_trade_count":    return "20"
  }
}

const fieldLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 }
const fieldLabelText: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "var(--c-fg-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em",
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", paddingRight: 28 }
