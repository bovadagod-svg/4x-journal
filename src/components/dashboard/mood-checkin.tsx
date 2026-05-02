"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"

type Mood = "calm" | "focused" | "confident" | "neutral" | "rushed" | "tilted"

const MOODS: Array<{ id: Mood; label: string; emoji: string; color: string }> = [
  { id: "calm",      label: "Calm",      emoji: "🌊", color: "#11C458" },
  { id: "focused",   label: "Focused",   emoji: "🎯", color: "#4312A0" },
  { id: "confident", label: "Confident", emoji: "⚡", color: "#E5A23B" },
  { id: "neutral",   label: "Neutral",   emoji: "○", color: "#9A97A1" },
  { id: "rushed",    label: "Rushed",    emoji: "⏱", color: "#BE333D" },
  { id: "tilted",    label: "Tilted",    emoji: "✕", color: "#BE333D" },
]

/**
 * Discipline check-in. Pure UI for now — selecting a mood updates local
 * state. Persisting daily mood + rules-followed % is a Phase 1.5 task
 * (would land alongside the JournalDrawer build-out).
 */
export function MoodCheckIn({
  initialMood,
  rulesFollowedPct,
  streakDays,
}: {
  initialMood: Mood | null
  rulesFollowedPct: number | null
  streakDays: number
}) {
  const [selected, setSelected] = useState<Mood | null>(initialMood)
  const pct = rulesFollowedPct ?? 0

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <div>
          <h3 className="card-title">Discipline Check-In</h3>
          <p className="card-subtitle">Pre-session mindset</p>
        </div>
        {streakDays > 0 && (
          <span className="chip chip-purple" style={{ fontSize: 10.5 }}>
            <Icon name="flame" size={11} /> {streakDays}-day streak
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
        {MOODS.map((m) => {
          const active = selected === m.id
          return (
            <button
              key={m.id}
              onClick={() => setSelected(active ? null : m.id)}
              style={{
                padding: "10px 8px",
                borderRadius: 8,
                border: `1px solid ${active ? m.color : "var(--c-border)"}`,
                background: active ? `${m.color}22` : "var(--c-bg-elev-2)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                color: "inherit",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18 }}>{m.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: active ? "var(--c-fg)" : "var(--c-fg-muted)" }}>{m.label}</span>
            </button>
          )
        })}
      </div>
      <div style={{ paddingTop: 10, borderTop: "1px solid var(--c-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>Rules followed (last 7d)</span>
          <span style={{ fontSize: 11.5, fontWeight: 600 }}>{rulesFollowedPct != null ? `${pct}%` : "—"}</span>
        </div>
        <div style={{ height: 4, background: "var(--c-bg-elev-3)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--c-purple-bright), var(--c-green-bright))",
          }} />
        </div>
      </div>
    </div>
  )
}
