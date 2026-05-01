"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"
import { TWEAK_DEFAULTS, type Tweaks } from "./types"

type TweaksContextValue = {
  tweaks: Tweaks
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void
}

const TweaksContext = createContext<TweaksContextValue | null>(null)

const LOCAL_KEY = "4xj.tweaks.v1"

export function TweaksProvider({
  initial,
  userId,
  children,
}: {
  initial: Tweaks
  userId: string | null
  children: React.ReactNode
}) {
  const [tweaks, setTweaks] = useState<Tweaks>(initial)

  // Hydrate from localStorage on mount in case server didn't have a session
  // (e.g. first paint during signup) — Supabase remains source of truth once auth'd.
  useEffect(() => {
    if (userId) return
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) setTweaks({ ...TWEAK_DEFAULTS, ...JSON.parse(raw) })
    } catch {}
  }, [userId])

  // Sync DOM attributes whenever tweaks change.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = tweaks.theme
    root.dataset.accent = tweaks.accent
    root.dataset.density = tweaks.density
  }, [tweaks.theme, tweaks.accent, tweaks.density])

  const setTweak = useCallback<TweaksContextValue["setTweak"]>(
    (key, value) => {
      setTweaks((prev) => {
        const next = { ...prev, [key]: value }
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
        } catch {}
        if (userId) {
          const supabase = createClient()
          const patch: Database["public"]["Tables"]["user_settings"]["Insert"] = { user_id: userId }
          if (key === "theme") patch.theme = value as string
          else if (key === "accent") patch.accent = value as string
          else if (key === "density") patch.density = value as string
          else if (key === "emptyState") patch.empty_state = value as boolean
          else if (key === "accountScope") patch.account_scope = value as string
          void supabase.from("user_settings").upsert(patch, { onConflict: "user_id" })
        }
        return next
      })
    },
    [userId],
  )

  return (
    <TweaksContext.Provider value={{ tweaks, setTweak }}>
      {children}
    </TweaksContext.Provider>
  )
}

export function useTweaks() {
  const ctx = useContext(TweaksContext)
  if (!ctx) throw new Error("useTweaks must be used inside TweaksProvider")
  return ctx
}
