"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Icon } from "@/components/icons"
import {
  RANGES,
  parseRangeSelection,
  rangeToSearchParams,
  type Range,
  type RangeSelection,
} from "@/lib/range"

/**
 * Page-level time-range filter. Two modes — preset pills (7D / 30D / 90D / All)
 * for fast switching, or a custom from/to date picker for arbitrary windows.
 *
 * URL is the source of truth:
 *   - "?range=7D" for presets
 *   - "?from=2026-02-01&to=2026-02-07" for custom
 *
 * Updating the URL via router.push() triggers the page server component to
 * re-fetch its data with the new bounds. useTransition keeps the bar
 * responsive while data loads.
 */
export function RangeFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sel = parseRangeSelection({
    range: searchParams.get("range"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  })
  const [pending, start] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(sel.kind === "custom")
  const popoverRef = useRef<HTMLDivElement>(null)

  // Local draft state for the date inputs, so the user can change one
  // without immediately refetching (we only navigate on Apply).
  const [draftFrom, setDraftFrom] = useState(sel.kind === "custom" ? sel.from : "")
  const [draftTo, setDraftTo] = useState(sel.kind === "custom" ? sel.to : "")

  // Sync drafts when the URL changes (e.g. user clicks a preset while picker open).
  useEffect(() => {
    if (sel.kind === "custom") {
      setDraftFrom(sel.from)
      setDraftTo(sel.to)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.kind === "custom" ? sel.from : "", sel.kind === "custom" ? sel.to : ""])

  // Close popover on outside click.
  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    window.addEventListener("mousedown", onClick)
    return () => window.removeEventListener("mousedown", onClick)
  }, [pickerOpen])

  const navigate = (next: RangeSelection) => {
    const params = rangeToSearchParams(next)
    // Preserve any other params the page uses (e.g. ?account= scope).
    searchParams.forEach((v, k) => {
      if (k !== "range" && k !== "from" && k !== "to") params.set(k, v)
    })
    const qs = params.toString()
    start(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  const onPreset = (r: Range) => {
    setPickerOpen(false)
    navigate({ kind: "preset", preset: r })
  }

  const onApplyCustom = () => {
    if (!draftFrom || !draftTo) return
    setPickerOpen(false)
    navigate({ kind: "custom", from: draftFrom, to: draftTo })
  }

  // Quick-pick helpers inside the popover.
  const setQuickRange = (daysFromOffset: number, daysSpan: number) => {
    const end = new Date()
    end.setDate(end.getDate() - daysFromOffset)
    const start2 = new Date(end)
    start2.setDate(start2.getDate() - (daysSpan - 1))
    setDraftFrom(toYmd(start2))
    setDraftTo(toYmd(end))
  }

  const isCustom = sel.kind === "custom"
  const today = toYmd(new Date())

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        opacity: pending ? 0.6 : 1,
        transition: "opacity 0.15s",
        position: "relative",
      }}
    >
      <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
        {RANGES.map((r) => {
          const active = !isCustom && sel.preset === r
          return (
            <button
              key={r}
              className={`tab ${active ? "active" : ""}`}
              onClick={() => onPreset(r)}
              disabled={pending}
              style={{ padding: "5px 12px", fontSize: 12 }}
            >
              {r}
            </button>
          )
        })}
        <button
          className={`tab ${isCustom ? "active" : ""}`}
          onClick={() => setPickerOpen((v) => !v)}
          disabled={pending}
          style={{
            padding: "5px 12px", fontSize: 12,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
          aria-expanded={pickerOpen}
        >
          <Icon name="calendar" size={11} />
          <span>{isCustom ? formatCustomLabel(sel) : "Custom"}</span>
        </button>
      </div>

      {pickerOpen && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0,
            zIndex: 30,
            background: "var(--c-bg-elev-1)",
            border: "1px solid var(--c-border)",
            borderRadius: 10,
            padding: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            minWidth: 320,
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Custom range
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="From">
              <input
                type="date"
                value={draftFrom}
                max={draftTo || today}
                onChange={(e) => setDraftFrom(e.target.value)}
                style={dateInput}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                max={today}
                onChange={(e) => setDraftTo(e.target.value)}
                style={dateInput}
              />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <QuickPick label="This week" onClick={() => setQuickRange(0, daysSinceMonday() + 1)} />
            <QuickPick label="Last week" onClick={() => setLastNWeeks(setDraftFrom, setDraftTo, 1)} />
            <QuickPick label="This month" onClick={() => setThisMonth(setDraftFrom, setDraftTo)} />
            <QuickPick label="Last month" onClick={() => setLastMonth(setDraftFrom, setDraftTo)} />
            <QuickPick label="YTD" onClick={() => setYearToDate(setDraftFrom, setDraftTo)} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => { setDraftFrom(""); setDraftTo("") }}
              className="btn"
              style={{ fontSize: 11, padding: "4px 10px" }}
              disabled={!draftFrom && !draftTo}
            >
              Clear
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="btn"
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onApplyCustom}
                className="btn btn-primary"
                style={{ fontSize: 11, padding: "4px 12px" }}
                disabled={!draftFrom || !draftTo || draftFrom > draftTo}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

function QuickPick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      style={{
        fontSize: 11, padding: "3px 8px",
        background: "var(--c-bg-elev-3)",
      }}
    >
      {label}
    </button>
  )
}

const dateInput: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  outline: "none",
  width: "100%",
}

function formatCustomLabel(sel: { from: string; to: string }): string {
  if (sel.from === sel.to) return formatYmdShort(sel.from)
  return `${formatYmdShort(sel.from)} – ${formatYmdShort(sel.to)}`
}

function formatYmdShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const now = new Date()
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear()
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "2-digit",
    timeZone: "UTC",
  })
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysSinceMonday(): number {
  // Sun=0; treat Sunday as start of week here too.
  const d = new Date().getDay()
  return d === 0 ? 6 : d - 1
}

function setLastNWeeks(setF: (s: string) => void, setT: (s: string) => void, _n: number) {
  // Last full week = previous Monday → Sunday
  const today = new Date()
  const dow = today.getDay()
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - (dow === 0 ? 7 : dow))
  const lastMonday = new Date(lastSunday)
  lastMonday.setDate(lastSunday.getDate() - 6)
  setF(toYmd(lastMonday))
  setT(toYmd(lastSunday))
}

function setThisMonth(setF: (s: string) => void, setT: (s: string) => void) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  setF(toYmd(first))
  setT(toYmd(now))
}

function setLastMonth(setF: (s: string) => void, setT: (s: string) => void) {
  const now = new Date()
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayPrev = new Date(firstThisMonth)
  lastDayPrev.setDate(0)
  const firstPrev = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), 1)
  setF(toYmd(firstPrev))
  setT(toYmd(lastDayPrev))
}

function setYearToDate(setF: (s: string) => void, setT: (s: string) => void) {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  setF(toYmd(jan1))
  setT(toYmd(now))
}
