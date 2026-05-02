"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { regenerateWebhookSecret } from "@/lib/actions/settings"

export function WebhookSection({ userId, secret, baseUrl }: { userId: string; secret: string | null; baseUrl: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState<string | null>(null)

  const url = secret ? `${baseUrl}/api/webhooks/tradingview/${userId}?secret=${secret}` : null

  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const onRotate = () => {
    if (!confirm("Rotate the webhook secret? Existing TradingView alerts will stop working until you paste the new URL.")) return
    startTransition(async () => {
      await regenerateWebhookSecret()
      router.refresh()
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {url ? (
        <>
          <Field label="Your TradingView webhook URL">
            <div style={{ display: "flex", gap: 6 }}>
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                style={{ ...mono, flex: 1 }}
              />
              <button onClick={() => copy(url, "url")} className="btn">
                <Icon name={copied === "url" ? "check" : "external"} size={12} />
                <span>{copied === "url" ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </Field>
          <Field label="Sample alert message body (paste into TradingView)">
            <textarea
              readOnly
              rows={7}
              onFocus={(e) => e.currentTarget.select()}
              value={`{
  "pair": "{{ticker}}",
  "side": "long",
  "entry": {{close}},
  "stop": 0,
  "target": 0,
  "size": 10000,
  "notes": "Alert: {{strategy.order.alert_message}}"
}`}
              style={{ ...mono, resize: "vertical" }}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onRotate} disabled={pending} className="btn">
              <Icon name="refresh" size={12} />
              <span>{pending ? "Rotating…" : "Rotate secret"}</span>
            </button>
          </div>
        </>
      ) : (
        <button onClick={onRotate} disabled={pending} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          <Icon name="plus" size={12} />
          <span>Generate webhook URL</span>
        </button>
      )}
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
        ⚠️ Server admin must set <code style={{ fontFamily: "var(--font-mono)" }}>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel env for the endpoint to actually insert trades.
      </p>
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

const mono: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  outline: "none",
  width: "100%",
}
