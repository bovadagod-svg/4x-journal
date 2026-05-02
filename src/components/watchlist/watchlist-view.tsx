"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Icon, PairFlag, type IconName } from "@/components/icons"
import { removeWatchlistPair, updateWatchlistPair } from "@/lib/actions/watchlist"
import type { WatchlistPair } from "@/lib/queries/watchlist"

type ViewMode = "table" | "cards"

const BIASES = [
  { value: "long", label: "Long", color: "var(--c-green-bright)", bg: "rgba(17, 196, 88, 0.12)", icon: "arrowUp" as IconName },
  { value: "short", label: "Short", color: "var(--c-red-bright)", bg: "rgba(190, 51, 61, 0.12)", icon: "arrowDown" as IconName },
  { value: "neutral", label: "Neutral", color: "var(--c-fg-muted)", bg: "var(--c-bg-elev-3)", icon: "refresh" as IconName },
] as const

export function WatchlistView({ pairs }: { pairs: WatchlistPair[] }) {
  const [view, setView] = useState<ViewMode>("table")
  const [filter, setFilter] = useState<"all" | "long" | "short" | "neutral">("all")

  const longs = pairs.filter((p) => p.bias === "long").length
  const shorts = pairs.filter((p) => p.bias === "short").length
  const neutrals = pairs.filter((p) => p.bias === "neutral").length
  const noted = pairs.filter((p) => p.setup_note && p.setup_note.length > 0).length

  const topBias = useMemo(() => {
    const counts = { long: longs, short: shorts, neutral: neutrals }
    const max = Math.max(longs, shorts, neutrals)
    if (max === 0) return null
    const which = (Object.keys(counts) as Array<keyof typeof counts>).find((k) => counts[k] === max)!
    return which
  }, [longs, shorts, neutrals])

  const filtered = filter === "all" ? pairs : pairs.filter((p) => p.bias === filter)

  return (
    <>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Kpi label="Watching" value={`${pairs.length} pair${pairs.length === 1 ? "" : "s"}`} sub="across FX, metals" />
        <BiasBreakdownCard longs={longs} shorts={shorts} neutrals={neutrals} />
        <Kpi label="Setup notes" value={String(noted)} sub={`of ${pairs.length} have a note`} color={noted > 0 ? "var(--c-accent-bright)" : "var(--c-fg-muted)"} />
        <TopBiasCard topBias={topBias} pairs={pairs} />
      </div>

      {/* Filter + view bar */}
      <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
          {(["all", "long", "short", "neutral"] as const).map((b) => {
            const count = b === "all" ? pairs.length : b === "long" ? longs : b === "short" ? shorts : neutrals
            return (
              <button
                key={b}
                onClick={() => setFilter(b)}
                className={`tab ${filter === b ? "active" : ""}`}
                style={{ padding: "5px 11px", fontSize: 12, textTransform: "capitalize" }}
              >
                {b} <span style={{ opacity: 0.6, marginLeft: 3 }}>{count}</span>
              </button>
            )
          })}
        </div>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{filtered.length} shown</span>
          <span style={{ width: 1, height: 20, background: "var(--c-border)" }} />
          <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
            <button onClick={() => setView("table")} className={`tab ${view === "table" ? "active" : ""}`} style={{ padding: "5px 11px", fontSize: 12 }}>Table</button>
            <button onClick={() => setView("cards")} className={`tab ${view === "cards" ? "active" : ""}`} style={{ padding: "5px 11px", fontSize: 12 }}>Cards</button>
          </div>
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "60px 20px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          {filter === "all" ? "No pairs on your watchlist yet." : `No pairs with bias = ${filter}.`}
        </div>
      ) : view === "table" ? (
        <WatchlistTable pairs={filtered} />
      ) : (
        <WatchlistCards pairs={filtered} />
      )}
    </>
  )
}

function WatchlistTable({ pairs }: { pairs: WatchlistPair[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(140px, 180px) 220px 1fr 60px",
        gap: 12, padding: "11px 16px",
        borderBottom: "1px solid var(--c-border)",
        background: "var(--c-bg-elev-2)",
        fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
      }}>
        <span>Pair</span>
        <span>Bias</span>
        <span>Setup note</span>
        <span style={{ textAlign: "right" }}></span>
      </div>
      {pairs.map((p, i) => (
        <WatchlistTableRow key={p.id} pair={p} isLast={i === pairs.length - 1} />
      ))}
    </div>
  )
}

function WatchlistTableRow({ pair, isLast }: { pair: WatchlistPair; isLast: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(pair.setup_note ?? "")

  const save = (patch: Partial<{ bias: string; setup_note: string | null }>) => {
    const fd = new FormData()
    fd.set("id", pair.id)
    if (patch.bias != null) fd.set("bias", patch.bias)
    if (patch.setup_note !== undefined) fd.set("setup_note", patch.setup_note ?? "")
    startTransition(async () => { await updateWatchlistPair(fd); router.refresh() })
  }

  const onDelete = () => {
    if (!confirm(`Remove ${pair.pair} from watchlist?`)) return
    startTransition(async () => { await removeWatchlistPair(pair.id); router.refresh() })
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(140px, 180px) 220px 1fr 60px",
      gap: 12, padding: "12px 16px",
      borderBottom: isLast ? "none" : "1px solid var(--c-border)",
      alignItems: "center", fontSize: 12.5,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <PairFlag pair={pair.pair} size={18} />
        <span style={{ fontWeight: 500 }}>{pair.pair}</span>
      </span>
      <BiasPicker bias={pair.bias} onChange={(b) => save({ bias: b })} />
      <div style={{ minWidth: 0 }}>
        {editingNote ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { save({ setup_note: note || null }); setEditingNote(false) }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") { setNote(pair.setup_note ?? ""); setEditingNote(false) }
            }}
            placeholder="Pre-session bias / key levels…"
            style={{
              padding: "6px 10px", borderRadius: 8,
              background: "var(--c-bg-elev-2)",
              border: "1px solid var(--c-accent-bright)",
              color: "var(--c-fg)", fontSize: 12.5,
              width: "100%", outline: "none",
            }}
          />
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            style={{
              background: "transparent", border: "none",
              padding: "4px 0", textAlign: "left",
              color: pair.setup_note ? "var(--c-fg-muted)" : "var(--c-fg-dim)",
              fontSize: 12, cursor: "text",
              width: "100%",
              fontStyle: pair.setup_note ? "normal" : "italic",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {pair.setup_note || "Add note…"}
          </button>
        )}
      </div>
      <span style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onDelete} className="btn" title={`Remove ${pair.pair}`} style={{ padding: "4px 8px" }}>
          <Icon name="x" size={11} />
        </button>
      </span>
    </div>
  )
}

function WatchlistCards({ pairs }: { pairs: WatchlistPair[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {pairs.map((p) => <WatchlistCard key={p.id} pair={p} />)}
    </div>
  )
}

function WatchlistCard({ pair }: { pair: WatchlistPair }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(pair.setup_note ?? "")

  const save = (patch: Partial<{ bias: string; setup_note: string | null }>) => {
    const fd = new FormData()
    fd.set("id", pair.id)
    if (patch.bias != null) fd.set("bias", patch.bias)
    if (patch.setup_note !== undefined) fd.set("setup_note", patch.setup_note ?? "")
    startTransition(async () => { await updateWatchlistPair(fd); router.refresh() })
  }

  const onDelete = () => {
    if (!confirm(`Remove ${pair.pair} from watchlist?`)) return
    startTransition(async () => { await removeWatchlistPair(pair.id); router.refresh() })
  }

  const meta = BIASES.find((b) => b.value === pair.bias) ?? BIASES[2]

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: meta.color }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PairFlag pair={pair.pair} size={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{pair.pair}</div>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 1 }}>
            added {new Date(pair.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>
        <BiasChip bias={pair.bias} />
      </div>

      <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Setup note</div>
        {editingNote ? (
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { save({ setup_note: note || null }); setEditingNote(false) }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setNote(pair.setup_note ?? ""); setEditingNote(false) }
            }}
            placeholder="Pre-session bias / key levels…"
            rows={3}
            style={{
              padding: "6px 10px", borderRadius: 8,
              background: "var(--c-bg-elev-2)",
              border: "1px solid var(--c-accent-bright)",
              color: "var(--c-fg)", fontSize: 12,
              width: "100%", outline: "none", resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            style={{
              background: "transparent", border: "none",
              padding: 0, textAlign: "left",
              color: pair.setup_note ? "var(--c-fg-muted)" : "var(--c-fg-dim)",
              fontSize: 12, lineHeight: 1.5, cursor: "text",
              width: "100%",
              fontStyle: pair.setup_note ? "normal" : "italic",
            }}
          >
            {pair.setup_note || "Add note…"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--c-border)", paddingTop: 10 }}>
        <BiasPicker bias={pair.bias} onChange={(b) => save({ bias: b })} compact />
        <button onClick={onDelete} className="btn" title="Remove" style={{ padding: "4px 8px" }}>
          <Icon name="x" size={11} />
        </button>
      </div>
    </div>
  )
}

function BiasChip({ bias }: { bias: string }) {
  const m = BIASES.find((b) => b.value === bias) ?? BIASES[2]
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 9px", borderRadius: 999,
      fontSize: 10.5, fontWeight: 600,
      color: m.color, background: m.bg,
      border: `1px solid ${m.color}33`,
      textTransform: "capitalize",
    }}>
      <Icon name={m.icon} size={10} /> {m.label}
    </span>
  )
}

function BiasPicker({ bias, onChange, compact }: { bias: string; onChange: (b: string) => void; compact?: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3,
      background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
      borderRadius: 8, padding: 3, width: compact ? "auto" : 220,
    }}>
      {BIASES.map((b) => {
        const active = bias === b.value
        return (
          <button
            key={b.value}
            onClick={() => onChange(b.value)}
            style={{
              padding: compact ? "4px 10px" : "5px 8px",
              borderRadius: 6, border: "none",
              background: active ? "var(--c-bg-elev-3)" : "transparent",
              color: active ? b.color : "var(--c-fg-muted)",
              fontSize: 11.5, fontWeight: 500, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            {compact && <Icon name={b.icon} size={9} />}
            {b.label}
          </button>
        )
      })}
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function BiasBreakdownCard({ longs, shorts, neutrals }: { longs: number; shorts: number; neutrals: number }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bias</div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "baseline", flexWrap: "wrap" }}>
        <div><span className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--c-green-bright)" }}>{longs}</span> <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>long</span></div>
        <div><span className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--c-red-bright)" }}>{shorts}</span> <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>short</span></div>
        <div><span className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--c-fg-muted)" }}>{neutrals}</span> <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>neutral</span></div>
      </div>
    </div>
  )
}

function TopBiasCard({ topBias, pairs }: { topBias: string | null; pairs: WatchlistPair[] }) {
  if (!topBias || pairs.length === 0) {
    return <Kpi label="Top Bias" value="—" sub="add pairs to track" />
  }
  const sample = pairs.find((p) => p.bias === topBias)?.pair ?? "—"
  const meta = BIASES.find((b) => b.value === topBias) ?? BIASES[2]
  return (
    <div className="card" style={{ padding: "14px 16px", background: `linear-gradient(135deg, ${meta.color}1A, transparent)` }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Bias</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginTop: 2, textTransform: "capitalize" }}>
        {topBias}
      </div>
      <div style={{ fontSize: 11, color: meta.color, marginTop: 2 }}>e.g. {sample}</div>
    </div>
  )
}
