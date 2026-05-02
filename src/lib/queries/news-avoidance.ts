import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type NewsEvent = Pick<
  Database["public"]["Tables"]["economic_events"]["Row"],
  "id" | "currency" | "event" | "impact" | "scheduled_at"
>

export type NewsAvoidanceContext = {
  enabled: boolean
  minutesBefore: number
  minutesAfter: number
  events: NewsEvent[] // upcoming + recent high-impact events within the active window
}

/**
 * Fetch the user's news-avoidance settings + the small set of high-impact
 * economic events within the active warn window. Used by the Log Trade modal
 * to fire a confirm dialog before submission when the trade pair's currencies
 * collide with a scheduled release.
 *
 * Returns disabled=false context with empty events when:
 *   - no user is signed in (caller still gets a safe default)
 *   - news_avoidance_enabled is off
 *
 * Window math:
 *   - blocked window = [event - minutesBefore, event + minutesAfter]
 *   - we fetch events where event > now - minutesAfter AND event < now + minutesBefore
 *     (so any event whose blocked window overlaps `now` is included)
 */
export async function getNewsAvoidanceContext(): Promise<NewsAvoidanceContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { enabled: false, minutesBefore: 0, minutesAfter: 0, events: [] }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("news_avoidance_enabled, news_avoidance_minutes_before, news_avoidance_minutes_after")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!settings?.news_avoidance_enabled) {
    return {
      enabled: false,
      minutesBefore: settings?.news_avoidance_minutes_before ?? 0,
      minutesAfter: settings?.news_avoidance_minutes_after ?? 0,
      events: [],
    }
  }

  const minutesBefore = settings.news_avoidance_minutes_before ?? 5
  const minutesAfter = settings.news_avoidance_minutes_after ?? 15

  const now = Date.now()
  const earliestEventTime = new Date(now - minutesAfter * 60_000).toISOString()
  const latestEventTime = new Date(now + minutesBefore * 60_000).toISOString()

  const { data } = await supabase
    .from("economic_events")
    .select("id, currency, event, impact, scheduled_at")
    .eq("impact", "high")
    .gte("scheduled_at", earliestEventTime)
    .lte("scheduled_at", latestEventTime)
    .order("scheduled_at", { ascending: true })

  return {
    enabled: true,
    minutesBefore,
    minutesAfter,
    events: data ?? [],
  }
}

/**
 * Pure helper — given a pair like "EUR/USD" or "XAU/USD", split into currency
 * codes and find any events that match.
 */
export function findCollidingEvents(pair: string, events: NewsEvent[]): NewsEvent[] {
  const ccys = pair.split("/").map((c) => c.trim().toUpperCase()).filter(Boolean)
  if (ccys.length === 0) return []
  return events.filter((e) => ccys.includes(e.currency.toUpperCase()))
}
