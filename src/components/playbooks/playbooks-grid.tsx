"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"
import { PlaybookCard } from "./playbook-card"
import { PlaybookFormModal } from "./playbook-form-modal"
import type { Playbook, PlaybookStats } from "@/lib/queries/playbooks"
import type { Trade } from "@/lib/queries/trades"

type Filter = "all" | "active" | "review" | "draft"

export function PlaybooksFilterAndGridImpl({
  playbooks,
  trades,
  totals,
}: {
  playbooks: Array<Playbook & { stats: PlaybookStats }>
  trades: Trade[]
  totals: { active: number; review: number; draft: number }
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [adding, setAdding] = useState(false)

  const filtered = filter === "all" ? playbooks : playbooks.filter((p) => p.status === filter)

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
          {(["all", "active", "review", "draft"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`tab ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
              style={{ padding: "6px 12px", fontSize: 12, textTransform: "capitalize" }}
            >
              {f}
              {f !== "all" && <span style={{ marginLeft: 4, color: "var(--c-fg-dim)" }}>{totals[f]}</span>}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-fg-muted)" }}>
          {filtered.length} of {playbooks.length}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {filtered.map((pb) => (
          <PlaybookCard key={pb.id} playbook={pb} recentTrades={trades} />
        ))}

        <button
          onClick={() => setAdding(true)}
          style={{
            background: "transparent",
            border: "1.5px dashed var(--c-border-strong)",
            borderRadius: "var(--radius-lg)",
            padding: 18,
            minHeight: 240,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            color: "var(--c-fg-muted)",
            cursor: "pointer",
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--c-bg-elev-2)", display: "grid", placeItems: "center" }}>
            <Icon name="plus" size={20} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>New Playbook</div>
          <div style={{ fontSize: 11.5, textAlign: "center", maxWidth: 200, lineHeight: 1.4 }}>
            Document a setup. Add rules, invalidations, and let your trades fill in the stats.
          </div>
        </button>
      </div>

      <PlaybookFormModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
