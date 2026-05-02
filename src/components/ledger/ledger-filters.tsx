"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/icons"

export type LedgerFilters = {
  search: string
  pair: string
  setup: string
  result: "All" | "Win" | "Loss" | "Breakeven"
  side: "All" | "Long" | "Short"
  date: string | null
}

export const EMPTY_FILTERS: LedgerFilters = {
  search: "",
  pair: "All",
  setup: "All",
  result: "All",
  side: "All",
  date: null,
}

export function LedgerFiltersBar({
  filters,
  setFilters,
  pairs,
  setups,
  onExportCsv,
}: {
  filters: LedgerFilters
  setFilters: (f: LedgerFilters) => void
  pairs: string[]
  setups: string[]
  onExportCsv?: () => void
}) {
  const update = <K extends keyof LedgerFilters>(k: K, v: LedgerFilters[K]) => setFilters({ ...filters, [k]: v })
  const hasActive =
    filters.pair !== "All" ||
    filters.setup !== "All" ||
    filters.result !== "All" ||
    filters.side !== "All" ||
    filters.search !== "" ||
    filters.date != null

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: 12,
        background: "var(--c-bg-elev-1)",
        border: "1px solid var(--c-border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "1 1 240px",
          minWidth: 200,
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 8,
          padding: "6px 10px",
        }}
      >
        <Icon name="search" size={14} color="var(--c-fg-muted)" />
        <input
          placeholder="Search by note, tag, pair…"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--c-fg)", fontSize: 12.5 }}
        />
      </div>

      <FilterSelect label="Pair" value={filters.pair} options={["All", ...pairs]} onChange={(v) => update("pair", v)} />
      <FilterSelect label="Setup" value={filters.setup} options={["All", ...setups]} onChange={(v) => update("setup", v)} />
      <FilterSelect label="Result" value={filters.result} options={["All", "Win", "Loss", "Breakeven"]} onChange={(v) => update("result", v as LedgerFilters["result"])} />
      <FilterSelect label="Side" value={filters.side} options={["All", "Long", "Short"]} onChange={(v) => update("side", v as LedgerFilters["side"])} />

      {filters.date && (
        <span className="chip chip-purple" style={{ fontSize: 11 }}>
          {filters.date}
          <button
            onClick={() => update("date", null)}
            style={{ background: "transparent", border: "none", color: "inherit", padding: 0, marginLeft: 4, display: "inline-flex", cursor: "pointer" }}
          >
            <Icon name="x" size={11} />
          </button>
        </span>
      )}

      {hasActive && (
        <button className="btn" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => setFilters(EMPTY_FILTERS)}>
          <Icon name="x" size={11} /> Clear
        </button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <button className="btn" style={{ fontSize: 11.5, padding: "6px 10px" }} onClick={onExportCsv}>
          <Icon name="external" size={12} /> Export CSV
        </button>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const isActive = value !== "All"

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: isActive ? "var(--c-purple-soft)" : "var(--c-bg-elev-2)",
          border: `1px solid ${isActive ? "rgba(105, 50, 212, 0.4)" : "var(--c-border)"}`,
          borderRadius: 8,
          fontSize: 12,
          color: "var(--c-fg)",
          cursor: "pointer",
        }}
      >
        <span style={{ color: "var(--c-fg-muted)" }}>{label}:</span>
        <span style={{ fontWeight: 500 }}>{value}</span>
        <Icon name="chevronDown" size={11} />
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
            minWidth: 160,
            maxHeight: 280,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {options.map((o) => (
            <button
              key={o}
              onClick={() => { onChange(o); setOpen(false) }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
                background: o === value ? "var(--c-bg-elev-3)" : "transparent",
                border: "none",
                borderRadius: 6,
                color: "var(--c-fg)",
                fontSize: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {o === value && <Icon name="check" size={11} color="var(--c-accent-bright)" />}
              <span style={{ marginLeft: o === value ? 0 : 19 }}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
