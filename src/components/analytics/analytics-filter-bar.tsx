"use client"

import { Icon, PairFlag } from "@/components/icons"
import { RangeFilterBar } from "@/components/shell/range-filter-bar"
import { MultiSelect, type MultiSelectOption } from "./multi-select"
import {
  analyticsFiltersActive,
  resultLabel,
  sideLabel,
  sessionLabel,
  type AnalyticsFilters,
  type AnalyticsFilterOptions,
} from "@/lib/analytics-filters"

/**
 * The Analytics page filter bar. Sits directly below the page title/subtitle
 * and gathers every filter the page supports: the URL-driven date range
 * (RangeFilterBar) on the left, then multi-select dropdowns for Pair, Playbook,
 * Result, Side, Account and Session. Dropdowns with no available options hide
 * themselves, so the bar stays tidy when a dimension is empty.
 */
export function AnalyticsFilterBar({
  options,
  filters,
  onChange,
}: {
  options: AnalyticsFilterOptions
  filters: AnalyticsFilters
  onChange: (next: AnalyticsFilters) => void
}) {
  const set = <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) =>
    onChange({ ...filters, [key]: value })

  const pairOptions: MultiSelectOption[] = options.pairs.map((p) => ({
    value: p,
    label: p,
    node: (
      <>
        <PairFlag pair={p} size={14} />
        <span style={{ whiteSpace: "nowrap" }}>{p}</span>
      </>
    ),
  }))
  const playbookOptions: MultiSelectOption[] = options.playbooks.map((p) => ({ value: p, label: p }))
  const resultOptions: MultiSelectOption[] = options.results.map((r) => ({ value: r, label: resultLabel(r) }))
  const sideOptions: MultiSelectOption[] = options.sides.map((s) => ({ value: s, label: sideLabel(s) }))
  const accountOptions: MultiSelectOption[] = options.accounts.map((a) => ({ value: a, label: a }))
  const sessionOptions: MultiSelectOption[] = options.sessions.map((s) => ({ value: s, label: sessionLabel(s) }))

  const active = analyticsFiltersActive(filters)

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
      <RangeFilterBar />

      <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "var(--c-border)", margin: "0 2px" }} />

      <Icon name="filter" size={13} color="var(--c-fg-muted)" style={{ marginRight: -2 }} />

      <MultiSelect label="Pair" options={pairOptions} selected={filters.pairs} onChange={(v) => set("pairs", v)} />
      <MultiSelect
        label="Playbook"
        options={playbookOptions}
        selected={filters.playbooks}
        onChange={(v) => set("playbooks", v)}
      />
      <MultiSelect
        label="Result"
        options={resultOptions}
        selected={filters.results}
        onChange={(v) => set("results", v as AnalyticsFilters["results"])}
      />
      <MultiSelect label="Side" options={sideOptions} selected={filters.sides} onChange={(v) => set("sides", v)} />
      <MultiSelect
        label="Account"
        options={accountOptions}
        selected={filters.accounts}
        onChange={(v) => set("accounts", v)}
      />
      <MultiSelect
        label="Session"
        options={sessionOptions}
        selected={filters.sessions}
        onChange={(v) => set("sessions", v as AnalyticsFilters["sessions"])}
      />

      {active && (
        <button
          type="button"
          className="btn"
          style={{ fontSize: 11.5, padding: "5px 10px", marginLeft: "auto" }}
          onClick={() =>
            onChange({ pairs: [], playbooks: [], results: [], sides: [], accounts: [], sessions: [] })
          }
        >
          <Icon name="x" size={11} /> Clear filters
        </button>
      )}
    </div>
  )
}
