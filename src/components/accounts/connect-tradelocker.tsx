"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { connectTradeLocker, type ConnectTLState } from "@/lib/actions/tradelocker"

export function ConnectTradeLockerButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn">
        <Icon name="external" size={13} />
        <span>Connect TradeLocker</span>
      </button>
      {open && <ConnectModal onClose={() => setOpen(false)} />}
    </>
  )
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ConnectTLState, FormData>(connectTradeLocker, undefined)

  useEffect(() => {
    if (state?.ok) {
      onClose()
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok])

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
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 100%)", maxHeight: "90vh", overflowY: "auto",
          background: "var(--c-bg-elev-1)", border: "1px solid var(--c-border-strong)",
          borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>Connect TradeLocker</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              We&apos;ll log in to TradeLocker and import your account list. Trades sync on demand from the account card.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Environment">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 3 }}>
              <Radio name="env" value="demo" defaultChecked label="Demo" />
              <Radio name="env" value="live" label="Live" />
            </div>
          </Field>
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" style={input} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required autoComplete="current-password" style={input} />
          </Field>
          <Field label="Server (from your TradeLocker login screen)">
            <input name="server" required placeholder="OSP-DEMO" style={{ ...input, fontFamily: "var(--font-mono)" }} />
            <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>
              Open TradeLocker — this is the dropdown value next to your login. Examples: <code style={{ fontFamily: "var(--font-mono)" }}>OSP-DEMO</code>, <code style={{ fontFamily: "var(--font-mono)" }}>FUNDED-LIVE</code>.
            </span>
          </Field>

          <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--c-fg)" }}>Heads up:</strong> credentials are stored encrypted-at-rest in your database row so we can re-auth on each sync. For production-grade security, move them to Supabase Vault — tracked as a follow-up. Use a demo account if you&apos;d rather not.
          </div>

          {state && !state.ok && (
            <div style={{ padding: 10, borderRadius: 8, background: "var(--c-red-soft)", color: "var(--c-red-bright)", fontSize: 12, lineHeight: 1.5 }}>
              <div><strong>Connection failed.</strong> {state.error}</div>
              {state.debug != null && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer", fontSize: 11 }}>Raw response</summary>
                  <pre style={{ margin: "6px 0 0", fontSize: 10.5, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {JSON.stringify(state.debug, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--c-border)" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            <Icon name="external" size={13} />
            <span>{pending ? "Connecting…" : "Connect"}</span>
          </button>
        </div>
      </form>
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

function Radio({ name, value, defaultChecked, label }: { name: string; value: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: "block", position: "relative", cursor: "pointer" }}>
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="sr-only-radio" style={{ position: "absolute", opacity: 0 }} />
      <span style={{
        display: "block", padding: "6px 10px", borderRadius: 6, textAlign: "center",
        background: "transparent", color: "var(--c-fg-muted)", fontSize: 12, fontWeight: 500,
      }} className="radio-pill">
        {label}
      </span>
      <style>{`
        .sr-only-radio:checked + .radio-pill { background: var(--c-bg-elev-3); color: var(--c-fg); }
      `}</style>
    </label>
  )
}

const input: React.CSSProperties = {
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
