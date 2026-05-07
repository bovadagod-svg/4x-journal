"use client"

import { useTransition } from "react"
import { setDashboardMode } from "@/lib/actions/dashboard-mode"
import type { DashboardMode } from "@/lib/dashboard-mode"

const OPTIONS: Array<{ value: DashboardMode; label: string; title: string }> = [
  { value: "auto", label: "Auto", title: "Lite for new traders, full once you have 50+ trades" },
  { value: "lite", label: "Lite", title: "Hide advanced widgets even with lots of trade history" },
  { value: "full", label: "Full", title: "Show every widget regardless of sample size" },
]

export function DashboardModeToggle({ current, effective }: { current: DashboardMode; effective: "lite" | "full" }) {
  const [pending, startTransition] = useTransition()

  return (
    <div
      className="tab-row"
      title={`Dashboard density: currently ${effective}`}
      style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8, opacity: pending ? 0.6 : 1 }}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={"tab " + (o.value === current ? "active" : "")}
          title={o.title}
          onClick={() => startTransition(() => { setDashboardMode(o.value) })}
          style={{ padding: "5px 10px", fontSize: 12 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
