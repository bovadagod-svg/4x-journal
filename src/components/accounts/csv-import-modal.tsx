"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { useAccounts, type Account } from "./accounts-context"
import { parseCsvFile, normalizeRows, type ColumnMap, type NormalizedTrade, type ParsedField } from "@/lib/integrations/csv/parser"
import { importCsvTrades } from "@/lib/actions/csv-import"

type Step = "pick" | "map" | "preview" | "done"

const FIELDS: { id: ParsedField; label: string; required?: boolean }[] = [
  { id: "pair", label: "Pair", required: true },
  { id: "side", label: "Side", required: true },
  { id: "entry_price", label: "Entry price", required: true },
  { id: "size", label: "Size", required: true },
  { id: "stop_price", label: "Stop price" },
  { id: "target_price", label: "Target price" },
  { id: "exit_price", label: "Exit price" },
  { id: "pnl", label: "P&L" },
  { id: "opened_at", label: "Opened at" },
  { id: "closed_at", label: "Closed at" },
  { id: "external_id", label: "External ID" },
  { id: "notes", label: "Notes" },
]

export function CsvImportModal({ open, onClose, defaultAccountId }: { open: boolean; onClose: () => void; defaultAccountId?: string }) {
  const router = useRouter()
  const { accounts } = useAccounts()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("pick")
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? accounts[0]?.id ?? "")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [columnMap, setColumnMap] = useState<ColumnMap>({})
  const [normalized, setNormalized] = useState<NormalizedTrade[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()
  const [summary, setSummary] = useState<{ total: number; imported: number; skipped_invalid: number; skipped_duplicate: number; fillsCreated: number } | null>(null)

  const reset = () => {
    setStep("pick"); setHeaders([]); setRows([]); setColumnMap({}); setNormalized([])
    setError(null); setSummary(null); if (fileRef.current) fileRef.current.value = ""
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    setError(null); setBusy(true)
    try {
      const result = await parseCsvFile(file)
      if (result.rows.length === 0) {
        setError("CSV has no data rows.")
        setBusy(false)
        return
      }
      setHeaders(result.headers)
      setRows(result.rows)
      setColumnMap(result.autoMap)
      setStep("map")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV.")
    }
    setBusy(false)
  }

  const proceedToPreview = () => {
    // Validate required fields are mapped
    const missing = FIELDS.filter((f) => f.required && !columnMap[f.id]).map((f) => f.label)
    if (missing.length > 0) {
      setError(`Map these required fields first: ${missing.join(", ")}`)
      return
    }
    setError(null)
    const norm = normalizeRows(rows, columnMap)
    setNormalized(norm)
    setStep("preview")
  }

  const submit = () => {
    if (!accountId) { setError("Pick an account."); return }
    setError(null); setBusy(true)
    const fd = new FormData()
    fd.set("account_id", accountId)
    fd.set("trades", JSON.stringify(normalized))
    startTransition(async () => {
      const r = await importCsvTrades(fd)
      setBusy(false)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setSummary(r.summary)
      setStep("done")
      router.refresh()
    })
  }

  if (!open) return null

  const validRows = normalized.filter((n) => !n.issue)
  const invalidRows = normalized.filter((n) => n.issue)

  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        zIndex: 100, display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)", maxHeight: "90vh", overflow: "hidden",
          background: "var(--c-bg-elev-1)", border: "1px solid var(--c-border-strong)",
          borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>Import CSV</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              {step === "pick" && "Upload a trade history CSV from MT4/5, cTrader, FunderPro, or any tabular export."}
              {step === "map" && "Confirm or override the auto-detected column mapping."}
              {step === "preview" && `Preview the ${validRows.length} valid row${validRows.length === 1 ? "" : "s"} before import.`}
              {step === "done" && "Import complete."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {error && (
            <div style={{ padding: 10, borderRadius: 8, background: "var(--c-red-soft)", color: "var(--c-red-bright)", fontSize: 12.5 }}>
              {error}
            </div>
          )}

          {step === "pick" && (
            <>
              <Field label="Import into account">
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.broker} · {a.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="CSV file">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  style={{
                    padding: "8px 10px", borderRadius: 8,
                    background: "var(--c-bg-elev-2)", border: "1px dashed var(--c-border-strong)",
                    color: "var(--c-fg)", fontSize: 13, outline: "none",
                  }}
                />
              </Field>
              <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
                <strong style={{ color: "var(--c-fg)" }}>Supported headers:</strong> pair / symbol, side / direction / type, entry / open, stop / SL, target / TP, exit / close, size / volume / lots, P&L / profit, open_time / date, close_time, ticket / id. Most exports auto-detect; you can override on the next step.
              </div>
            </>
          )}

          {step === "map" && (
            <>
              <p style={{ margin: 0, fontSize: 12, color: "var(--c-fg-muted)" }}>
                {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} parsed. Confirm column mapping.
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                {FIELDS.map((f) => (
                  <div key={f.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 80px", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--c-fg)" }}>
                      {f.label}{f.required && <span style={{ color: "var(--c-red-bright)" }}> *</span>}
                    </span>
                    <select
                      value={columnMap[f.id] ?? ""}
                      onChange={(e) => setColumnMap({ ...columnMap, [f.id]: e.target.value || undefined })}
                      style={inputStyle}
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
                      {columnMap[f.id] && rows[0]?.[columnMap[f.id]!]
                        ? `e.g. ${truncate(rows[0][columnMap[f.id]!])}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <SummaryStat label="Will import" value={String(validRows.length)} color="var(--c-green-bright)" />
                <SummaryStat label="Skipped (invalid)" value={String(invalidRows.length)} color={invalidRows.length > 0 ? "var(--c-amber)" : "var(--c-fg-muted)"} />
                <SummaryStat label="Total parsed" value={String(normalized.length)} color="var(--c-fg)" />
              </div>

              {/* Valid preview */}
              <div>
                <div style={{ fontSize: 11, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  First {Math.min(8, validRows.length)} valid rows
                </div>
                <div style={{ overflowX: "auto", border: "1px solid var(--c-border)", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--c-bg-elev-2)" }}>
                        <Th>Pair</Th><Th>Side</Th><Th align="right">Entry</Th><Th align="right">Stop</Th><Th align="right">Exit</Th><Th align="right">Size</Th><Th align="right">P&L</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 8).map((t, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--c-border)" }}>
                          <Td mono>{t.pair}</Td>
                          <Td>{t.side}</Td>
                          <Td mono align="right">{t.entry_price.toFixed(5)}</Td>
                          <Td mono align="right">{t.stop_price?.toFixed(5) ?? "—"}</Td>
                          <Td mono align="right">{t.exit_price?.toFixed(5) ?? "—"}</Td>
                          <Td mono align="right">{t.size}</Td>
                          <Td mono align="right" color={t.pnl != null ? (t.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)") : undefined}>
                            {t.pnl != null ? t.pnl.toFixed(2) : "—"}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invalid preview */}
              {invalidRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--c-amber)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Skipped — {invalidRows.length} row{invalidRows.length === 1 ? "" : "s"}
                  </div>
                  <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 10, maxHeight: 120, overflowY: "auto", fontSize: 11.5, color: "var(--c-fg-muted)" }}>
                    {Array.from(new Set(invalidRows.map((r) => r.issue))).map((issue) => (
                      <div key={issue}>• {invalidRows.filter((r) => r.issue === issue).length}× — {issue}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "done" && summary && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 16, background: "rgba(17, 196, 88, 0.06)", border: "1px solid rgba(17, 196, 88, 0.25)", borderRadius: 10, fontSize: 13, color: "var(--c-fg)" }}>
                ✓ Imported <strong>{summary.imported}</strong> trade{summary.imported === 1 ? "" : "s"} ({summary.fillsCreated} fills) into your account.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <SummaryStat label="Imported" value={String(summary.imported)} color="var(--c-green-bright)" />
                <SummaryStat label="Skipped invalid" value={String(summary.skipped_invalid)} color={summary.skipped_invalid > 0 ? "var(--c-amber)" : "var(--c-fg-muted)"} />
                <SummaryStat label="Total parsed" value={String(summary.total)} color="var(--c-fg)" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
          {step !== "pick" && step !== "done" ? (
            <button type="button" onClick={() => { setStep(step === "preview" ? "map" : "pick"); setError(null) }} className="btn">
              Back
            </button>
          ) : <span />}

          <div style={{ display: "flex", gap: 8 }}>
            {step === "done" ? (
              <>
                <button type="button" onClick={() => { reset() }} className="btn">Import another</button>
                <a href="/ledger" className="btn btn-primary">View ledger</a>
              </>
            ) : (
              <>
                <button type="button" onClick={onClose} className="btn">Cancel</button>
                {step === "map" && (
                  <button type="button" onClick={proceedToPreview} disabled={busy} className="btn btn-primary">
                    Preview <Icon name="chevronRight" size={11} />
                  </button>
                )}
                {step === "preview" && (
                  <button type="button" onClick={submit} disabled={busy || validRows.length === 0} className="btn btn-primary">
                    <Icon name="plus" size={12} /> {busy ? "Importing…" : `Import ${validRows.length} trades`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CsvImportButton({ defaultAccountId }: { defaultAccountId?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn">
        <Icon name="external" size={13} />
        <span>Import CSV</span>
      </button>
      <CsvImportModal open={open} onClose={() => setOpen(false)} defaultAccountId={defaultAccountId} />
    </>
  )
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th style={{ padding: "8px 10px", fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: align ?? "left", fontWeight: 500 }}>
      {children}
    </th>
  )
}
function Td({ children, mono, align, color }: { children: React.ReactNode; mono?: boolean; align?: "right"; color?: string }) {
  return (
    <td className={mono ? "mono tnum" : ""} style={{ padding: "8px 10px", fontSize: 12, color, textAlign: align ?? "left", whiteSpace: "nowrap" }}>
      {children}
    </td>
  )
}

function truncate(s: string, n = 24): string {
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 13,
  outline: "none",
  width: "100%",
}
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, display: "grid", placeItems: "center",
  background: "transparent", border: "1px solid var(--c-border)",
  borderRadius: 8, color: "var(--c-fg-muted)",
}
