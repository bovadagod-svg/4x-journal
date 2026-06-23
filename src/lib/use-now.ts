"use client"

import { useSyncExternalStore } from "react"

/**
 * A single minute-ticking wall clock shared by every `useNow()` consumer, read
 * through `useSyncExternalStore` so it's SSR-safe:
 *
 *   - `getServerSnapshot` returns `null`, so the server render and the first
 *     client (hydration) render agree — no hydration mismatch on time-dependent
 *     UI. Callers render a placeholder while the value is `null`.
 *   - `getSnapshot` returns a cached millisecond value (only reassigned when the
 *     interval fires), so React doesn't loop.
 *   - One interval backs all consumers and is torn down when the last unmounts.
 */
let current: number | null = null
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (timer === null) {
    current = Date.now()
    timer = setInterval(() => {
      current = Date.now()
      for (const l of listeners) l()
    }, 60_000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot(): number | null {
  // First client read can land before the subscription effect runs; seed it so
  // the value is live immediately rather than after the first interval tick.
  if (current === null) current = Date.now()
  return current
}

function getServerSnapshot(): number | null {
  return null
}

/**
 * Current time, refreshed every 60s. Returns `null` until mounted; callers
 * render a placeholder while it's null.
 */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return ms === null ? null : new Date(ms)
}
