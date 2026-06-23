"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/icons"

export type MultiSelectOption = {
  value: string
  /** Plain-text label (also used as the title/aria fallback). */
  label: string
  /** Optional richer node rendered in place of the label (e.g. a pair flag). */
  node?: React.ReactNode
}

/**
 * A compact multi-select dropdown used by the Analytics filter bar. Mirrors the
 * single-select FilterSelect in ledger-filters, but each row is a checkbox so
 * the user can pick any subset. An empty selection means "no constraint", so
 * the trigger only lights up once at least one option is checked.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (options.length === 0) return null

  const count = selected.length
  const active = count > 0
  const allSelected = count === options.length

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: active ? "var(--c-purple-soft)" : "var(--c-bg-elev-2)",
          border: `1px solid ${active ? "rgba(105, 50, 212, 0.4)" : "var(--c-border)"}`,
          borderRadius: 8,
          fontSize: 12,
          color: "var(--c-fg)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: active ? "var(--c-fg)" : "var(--c-fg-muted)", fontWeight: active ? 500 : 400 }}>
          {label}
        </span>
        {active && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              lineHeight: 1,
              padding: "2px 6px",
              borderRadius: 999,
              background: "var(--c-purple-bright)",
              color: "#fff",
              fontFamily: "var(--font-mono)",
            }}
          >
            {allSelected ? "All" : count}
          </span>
        )}
        <Icon name="chevronDown" size={11} color="var(--c-fg-muted)" />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            background: "var(--c-bg-elev-2)",
            border: "1px solid var(--c-border)",
            borderRadius: 8,
            padding: 4,
            minWidth: 190,
            maxHeight: 320,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px 6px",
              borderBottom: "1px solid var(--c-border)",
              marginBottom: 4,
            }}
          >
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              disabled={allSelected}
              style={miniBtn(allSelected)}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!active}
              style={miniBtn(!active)}
            >
              Clear
            </button>
          </div>

          {options.map((o) => {
            const checked = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "7px 10px",
                  background: checked ? "var(--c-bg-elev-3)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  color: "var(--c-fg)",
                  fontSize: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 15,
                    height: 15,
                    flexShrink: 0,
                    borderRadius: 4,
                    border: `1.5px solid ${checked ? "var(--c-purple-bright)" : "var(--c-border)"}`,
                    background: checked ? "var(--c-purple-bright)" : "transparent",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {checked && <Icon name="check" size={10} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {o.node ?? o.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function miniBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    padding: "2px 4px",
    fontSize: 11,
    fontWeight: 500,
    color: disabled ? "var(--c-fg-dim)" : "var(--c-purple-bright)",
    cursor: disabled ? "default" : "pointer",
  }
}
