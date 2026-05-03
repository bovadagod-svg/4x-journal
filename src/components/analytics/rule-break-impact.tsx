"use client"

import { useMemo } from "react"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import type { Trade, JournalEntry } from "@/lib/queries/trades"

/**
 * Rule-break impact card. Compares trades where the user logged a rule break
 * (rule_break = true on the linked journal entry) vs. clean trades. Quantifies
 * the cost in dollars + win rate gap, then surfaces the most common
 * rule-break tags + mistakes so the user can name what's actually happening.
 */
export function RuleBreakImpact({ trades, entriesByTrade }: { trades: Trade[]; entriesByTrade: Map<string, JournalEntry> }) {
  const stats = useMemo(() => compute(trades, entriesByTrade), [trades, entriesByTrade])

  if (stats.tagged === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Rule-Break Impact</h3>
        <p className="card-subtitle">Tag entries with rule breaks to quantify their cost</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          Open a journal entry → Tags tab → toggle "Rule break?" — the impact compounds quickly.
        </p>
      </div>
    )
  }

  const wrGap = stats.broken.count > 0 && stats.clean.count > 0
    ? stats.clean.winRate - stats.broken.winRate
    : null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Rule-Break Impact</h3>
        <p className="card-subtitle">
          {stats.tagged} of {trades.length} trades tagged · {stats.broken.count} rule-break{stats.broken.count === 1 ? "" : "s"} logged
        </p>
      </div>

      {/* Headline costs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        <Stat
          label="Rule-break cost"
          value={stats.broken.count > 0 ? formatUSD(stats.broken.pnl, { signed: true }) : "—"}
          sub={`${stats.broken.count} trade${stats.broken.count === 1 ? "" : "s"}`}
          color={stats.broken.pnl <= 0 ? "var(--c-red-bright)" : "var(--c-amber)"}
        />
        <Stat
          label="Clean P&L"
          value={stats.clean.count > 0 ? formatUSD(stats.clean.pnl, { signed: true }) : "—"}
          sub={`${stats.clean.count} trade${stats.clean.count === 1 ? "" : "s"}`}
          color={stats.clean.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"}
        />
        <Stat
          label="WR gap"
          value={wrGap != null ? `${wrGap >= 0 ? "+" : ""}${Math.round(wrGap)}pp` : "—"}
          sub={wrGap != null && wrGap > 0 ? "clean trades win more" : wrGap != null && wrGap < 0 ? "broken trades win more (?)" : "no comparison"}
          color={wrGap != null && wrGap > 5 ? "var(--c-green-bright)" : wrGap != null && wrGap < -5 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Stat
          label="Avg R loss"
          value={stats.broken.count > 0 ? `${stats.broken.avgR > 0 ? "+" : ""}${stats.broken.avgR.toFixed(2)}R` : "—"}
          sub="per rule-break trade"
          color={stats.broken.avgR <= 0 ? "var(--c-red-bright)" : "var(--c-amber)"}
        />
      </div>

      {/* Top tags + mistakes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <TagList title="Top rule-break tags" tags={stats.topRuleBreakTags} emptyText="No tags logged on rule-break entries." />
        <TagList title="Top mistakes (all entries)" tags={stats.topMistakes} emptyText="No mistakes logged." />
      </div>

      {wrGap != null && wrGap > 5 && stats.broken.count >= 3 && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(190, 51, 61, 0.06)", border: "1px solid rgba(190, 51, 61, 0.2)", borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="flame" size={13} color="var(--c-red-bright)" />
          <span>
            Discipline is worth <strong style={{ color: "var(--c-red-bright)" }}>{Math.round(wrGap)} percentage points</strong> of win rate. The {stats.broken.count} rule-break trade{stats.broken.count === 1 ? " has" : "s have"} cost{" "}
            <strong style={{ color: "var(--c-red-bright)" }}>{formatUSD(Math.abs(stats.broken.pnl < 0 ? stats.broken.pnl : 0))}</strong> directly.
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function TagList({ title, tags, emptyText }: { title: string; tags: { tag: string; count: number }[]; emptyText: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{title}</div>
      {tags.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--c-fg-dim)", padding: "8px 0" }}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {tags.map((t) => (
            <span
              key={t.tag}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 999,
                fontSize: 10.5,
                background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
                color: "var(--c-fg-muted)",
              }}
            >
              <span style={{ color: "var(--c-fg)" }}>{t.tag}</span>
              <span className="tnum" style={{ fontSize: 10, color: "var(--c-fg-dim)" }}>×{t.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function compute(trades: Trade[], entriesByTrade: Map<string, JournalEntry>) {
  let tagged = 0
  const broken: Trade[] = []
  const clean: Trade[] = []
  const ruleBreakTagCounts = new Map<string, number>()
  const mistakeCounts = new Map<string, number>()

  for (const t of trades) {
    if (t.status !== "closed") continue
    const e = entriesByTrade.get(t.id)
    if (!e) continue
    tagged++
    if (e.rule_break) {
      broken.push(t)
      for (const tag of e.rule_break_tags ?? []) {
        ruleBreakTagCounts.set(tag, (ruleBreakTagCounts.get(tag) ?? 0) + 1)
      }
    } else {
      clean.push(t)
    }
    for (const m of e.mistakes ?? []) {
      mistakeCounts.set(m, (mistakeCounts.get(m) ?? 0) + 1)
    }
  }

  return {
    tagged,
    broken: aggGroup(broken),
    clean: aggGroup(clean),
    topRuleBreakTags: topN(ruleBreakTagCounts, 6),
    topMistakes: topN(mistakeCounts, 6),
  }
}

function aggGroup(ts: Trade[]) {
  const wins = ts.filter((t) => Number(t.pnl) > 0).length
  const pnl = ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const totalR = ts.reduce((s, t) => s + (Number(t.r) || 0), 0)
  return {
    count: ts.length,
    winRate: ts.length > 0 ? (wins / ts.length) * 100 : 0,
    pnl,
    avgR: ts.length > 0 ? totalR / ts.length : 0,
  }
}

function topN(m: Map<string, number>, n: number): { tag: string; count: number }[] {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag, count]) => ({ tag, count }))
}
