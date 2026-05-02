"use client"

import { useEffect, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { subscribePush, unsubscribePush } from "@/lib/actions/push"

/**
 * Push notifications section in Settings → Notifications.
 *
 * Uses the browser's PushManager API. Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * to be present in the bundle to register with the push service. When the
 * key is missing, shows a "not configured" hint with setup instructions.
 *
 * Not in HTTPS / localhost: PushManager just won't be available, we surface
 * that case too.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

type Status =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "not-configured" }
  | { kind: "subscribed"; endpoint: string }
  | { kind: "unsubscribed" }
  | { kind: "error"; message: string }

export function PushSection() {
  const [status, setStatus] = useState<Status>({ kind: "loading" })
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) {
      setStatus({ kind: "not-configured" })
      return
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus({ kind: "unsupported", reason: "Your browser doesn't support push notifications." })
      return
    }
    void (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null)
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) setStatus({ kind: "subscribed", endpoint: sub.endpoint })
      else setStatus({ kind: "unsubscribed" })
    })()
  }, [])

  const onEnable = () => {
    if (!VAPID_PUBLIC_KEY) return
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js")
        await navigator.serviceWorker.ready
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          setStatus({ kind: "error", message: "Notification permission denied." })
          return
        }
        const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        // Cast: PushManager spec accepts Uint8Array but lib.dom.d.ts shape is
        // overly strict in newer TS — runtime accepts the typed array.
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes as unknown as BufferSource,
        })
        const fd = new FormData()
        fd.set("endpoint", sub.endpoint)
        const json = sub.toJSON()
        fd.set("p256dh", json.keys?.p256dh ?? "")
        fd.set("auth", json.keys?.auth ?? "")
        fd.set("user_agent", navigator.userAgent)
        const r = await subscribePush(fd)
        if (r.ok) setStatus({ kind: "subscribed", endpoint: sub.endpoint })
        else setStatus({ kind: "error", message: r.error })
      } catch (e) {
        setStatus({ kind: "error", message: e instanceof Error ? e.message : "Subscribe failed." })
      }
    })
  }

  const onDisable = () => {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null)
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await sub.unsubscribe()
        await unsubscribePush(sub.endpoint)
      }
      setStatus({ kind: "unsubscribed" })
    })
  }

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="bell" size={14} color="var(--c-purple-bright)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Browser push notifications</span>
        {status.kind === "subscribed" && (
          <span className="chip chip-green" style={{ fontSize: 10, marginLeft: "auto" }}>Active</span>
        )}
      </div>
      {status.kind === "loading" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--c-fg-muted)" }}>Checking…</p>
      )}
      {status.kind === "unsupported" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--c-fg-muted)" }}>{status.reason}</p>
      )}
      {status.kind === "not-configured" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          Browser push isn&apos;t configured on this deployment. Generate VAPID keys with{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>npx web-push generate-vapid-keys</code> and set{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>,{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>VAPID_PRIVATE_KEY</code>, and{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>VAPID_SUBJECT</code> (mailto:you@example.com) in your environment.
        </p>
      )}
      {status.kind === "unsubscribed" && (
        <>
          <p style={{ margin: 0, fontSize: 12, color: "var(--c-fg-muted)" }}>
            Get instant alerts on this device when daily DD is approaching, when a high-impact news window opens, or when a payout is eligible.
          </p>
          <button onClick={onEnable} disabled={pending} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
            <Icon name="bell" size={11} /> <span>{pending ? "Enabling…" : "Enable on this device"}</span>
          </button>
        </>
      )}
      {status.kind === "subscribed" && (
        <>
          <p style={{ margin: 0, fontSize: 12, color: "var(--c-fg-muted)" }}>
            This device will receive push alerts. Toggle individual alert types in the rows above.
          </p>
          <button onClick={onDisable} disabled={pending} className="btn" style={{ alignSelf: "flex-start" }}>
            {pending ? "Disabling…" : "Disable on this device"}
          </button>
        </>
      )}
      {status.kind === "error" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--c-red-bright)" }}>{status.message}</p>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const buf = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) buf[i] = rawData.charCodeAt(i)
  return buf
}
