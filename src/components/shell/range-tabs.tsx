"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import { RANGES, type Range, DEFAULT_RANGE, parseRange } from "@/lib/range"

/**
 * Page-level time-range tab strip. Updates the `?range=` URL param via
 * router.push(); the surrounding server component re-renders with the new
 * range piped into its data fetches.
 *
 * `useTransition` keeps the tab interactive (and shows a faint pending
 * state) while the server component re-fetches, instead of blocking the
 * UI.
 */
export function RangeTabs({ scope = "this view" }: { scope?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = parseRange(searchParams.get("range"))
  const [pending, start] = useTransition()

  const setRange = (r: Range) => {
    const params = new URLSearchParams(searchParams.toString())
    if (r === DEFAULT_RANGE) params.delete("range")
    else params.set("range", r)
    const qs = params.toString()
    start(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <div
      className="tab-row"
      style={{
        background: "var(--c-bg-elev-2)",
        padding: 3,
        borderRadius: 8,
        opacity: pending ? 0.6 : 1,
        transition: "opacity 0.15s",
      }}
      title={`Filter ${scope} by time range`}
    >
      {RANGES.map((r) => (
        <button
          key={r}
          className={`tab ${r === current ? "active" : ""}`}
          onClick={() => setRange(r)}
          disabled={pending}
          style={{ padding: "5px 12px", fontSize: 12 }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
