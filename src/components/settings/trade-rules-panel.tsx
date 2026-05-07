"use client"

import { useEffect, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import {
  createTradeRule,
  listTradeRules,
  toggleTradeRule,
  deleteTradeRule,
  type TradeRule,
} from "@/lib/actions/trade-rules"

/**
 * Settings → Behavior → Trade rules panel. Lists existing rules with toggle/
 * delete and a small create form for the v1 rule kind: block_pair_side.
 */
export function TradeRulesPanel() {
  const [rules, setRules] = useState<TradeRule[] | null>(null)
  const [pair, setPair] = useState("")
  const [side, setSide] = useState<"long" | "short">("long")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void (async () => setRules(await listTradeRules()))()
  }, [])

  const refresh = async () => setRules(await listTradeRules())

  const onAdd = () => {
    setError(null)
    if (!pair.trim()) { setError("Pair required."); return }
    startTransition(async () => {
      const r = await createTradeRule({
        kind: "block_pair_side",
        payload: { pair: pair.trim().toUpperCase(), side },
        reason: reason.trim() || null,
        source: "manual",
        severity: "warn",
      })
      if (r.ok) {
        setPair(""); setReason(""); setSide("long")
        await refresh()
      } else {
        setError(r.error)
      }
    })
  }

  const onToggle = (id: string, enabled: boolean) => {
    startTransition(async () => { await toggleTradeRule(id, enabled); await refresh() })
  }
  const onDelete = (id: string) => {
    if (!confirm("Delete this rule?")) return
    startTransition(async () => { await deleteTradeRule(id); await refresh() })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>Trade rules</h3>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          Block specific pair/side combinations. Enabled rules trigger a confirm dialog when you try to log a matching trade.
        </p>
      </div>

      {/* Existing rules */}
      {rules == null ? (
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>Loading…</div>
      ) : rules.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--c-fg-dim)", padding: "10px 0" }}>No rules yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rules.map((r) => {
            const p = r.payload as { pair?: string; side?: string }
            const summary = r.kind === "block_pair_side"
              ? `No ${p.side} on ${p.pair}`
              : r.kind
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                background: "var(--c-bg-elev-2)",
                border: "1px solid var(--c-border)",
                borderRadius: 8,
              }}>
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => onToggle(r.id, e.target.checked)}
                  style={{ accentColor: "var(--c-accent-bright)" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: r.enabled ? "var(--c-fg)" : "var(--c-fg-dim)" }}>
                    {summary}
                  </div>
                  {r.reason && (
                    <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{r.reason}</div>
                  )}
                </div>
                <span className="chip" style={{ fontSize: 9.5, padding: "1px 6px", color: r.source === "coach" ? "var(--c-purple-bright)" : "var(--c-fg-muted)" }}>
                  {r.source.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  title="Delete"
                  style={{
                    width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", border: "1px solid var(--c-border)", borderRadius: 6,
                    color: "var(--c-fg-muted)", cursor: "pointer",
                  }}
                >
                  <Icon name="x" size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 12 }}>
        <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginBottom: 8 }}>Add a rule</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr auto", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={pair}
            onChange={(e) => setPair(e.target.value.toUpperCase())}
            placeholder="EUR/USD"
            disabled={pending}
            style={inputStyle}
          />
          <select value={side} onChange={(e) => setSide(e.target.value as "long" | "short")} disabled={pending} style={inputStyle}>
            <option value="long">long</option>
            <option value="short">short</option>
          </select>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional: why?"
            disabled={pending}
            style={inputStyle}
          />
          <button type="button" onClick={onAdd} disabled={pending} className="btn">
            <Icon name="plus" size={11} /> Add
          </button>
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 11, color: "var(--c-red-bright)" }}>{error}</div>}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 12.5,
  outline: "none",
}
