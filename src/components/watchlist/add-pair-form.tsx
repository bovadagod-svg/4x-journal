"use client"

import { useActionState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { addWatchlistPair, applyMajorsPreset, type WatchlistFormState } from "@/lib/actions/watchlist"
import { COMMON_PAIRS } from "@/lib/finance"

export function AddPairForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState<WatchlistFormState, FormData>(addWatchlistPair, undefined)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      router.refresh()
    }
  }, [state, router])

  const onMajors = () => {
    startTransition(async () => {
      await applyMajorsPreset()
      router.refresh()
    })
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <form ref={formRef} action={action} style={{ display: "flex", gap: 6 }}>
        <input
          name="pair"
          list="pair-options"
          placeholder="EUR/USD"
          required
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--c-bg-elev-2)",
            border: "1px solid var(--c-border)",
            color: "var(--c-fg)",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            outline: "none",
            width: 140,
          }}
        />
        <datalist id="pair-options">
          {COMMON_PAIRS.map((p) => <option key={p} value={p} />)}
        </datalist>
        <select name="bias" defaultValue="neutral" style={{
          padding: "8px 10px", borderRadius: 8,
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          color: "var(--c-fg)",
          fontSize: 13,
          outline: "none",
        }}>
          <option value="neutral">Neutral</option>
          <option value="long">Long bias</option>
          <option value="short">Short bias</option>
        </select>
        <button type="submit" disabled={pending} className="btn btn-primary">
          <Icon name="plus" size={13} />
          <span>Add pair</span>
        </button>
      </form>
      <button type="button" onClick={onMajors} className="btn">
        <Icon name="watchlist" size={13} />
        <span>Use majors preset</span>
      </button>
      {state && !state.ok && (
        <span style={{ fontSize: 12, color: "var(--c-red-bright)", marginLeft: 4 }}>{state.error}</span>
      )}
    </div>
  )
}
