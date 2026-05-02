"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

/**
 * Subscribes to Supabase Realtime events on `trades` and `trade_fills` for
 * the signed-in user, calling `router.refresh()` on any change so server
 * components re-fetch with the new state.
 *
 * Mounted once at the dashboard layout level so every page benefits without
 * each page wiring its own subscription.
 *
 * Notes:
 *   - RLS gates events at the realtime layer, so a multi-tenant deployment
 *     wouldn't leak across users — we still scope explicitly via the
 *     filter clause for clarity + a small efficiency win.
 *   - We debounce burst inserts (TradeLocker sync writes ~12 trades + 12 fills
 *     in quick succession) so we don't refresh the page mid-write.
 */
export function RealtimeTrades({ userId }: { userId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        router.refresh()
      }, 600)
    }

    const channel = supabase
      .channel(`trades-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trade_fills",
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefresh,
      )
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [userId, router])

  return null
}
