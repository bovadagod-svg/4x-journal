import { describe, expect, it } from "vitest"
import { formatInZone } from "./datetime"

// Use 24h numeric hours so assertions don't depend on locale AM/PM spacing
// (recent ICU uses a narrow no-break space before AM/PM).
const HOUR24: Intl.DateTimeFormatOptions = { hour: "2-digit", hour12: false }

describe("formatInZone", () => {
  const iso = "2026-06-20T13:54:00Z" // Saturday 13:54 UTC

  it("renders the same UTC instant in each zone's wall-clock hour", () => {
    expect(formatInZone(iso, "UTC", HOUR24)).toBe("13")
    expect(formatInZone(iso, "America/New_York", HOUR24)).toBe("09") // EDT, UTC-4
    expect(formatInZone(iso, "Europe/London", HOUR24)).toBe("14")    // BST, UTC+1
    expect(formatInZone(iso, "Asia/Tokyo", HOUR24)).toBe("22")       // JST, UTC+9
  })

  it("returns '' for null/undefined/invalid input", () => {
    expect(formatInZone(null, "UTC", HOUR24)).toBe("")
    expect(formatInZone(undefined, "UTC", HOUR24)).toBe("")
    expect(formatInZone("not-a-date", "UTC", HOUR24)).toBe("")
  })

  it("does not throw on an invalid timeZone (falls back to host zone)", () => {
    expect(() => formatInZone(iso, "Not/AZone", HOUR24)).not.toThrow()
  })

  it("accepts ISO strings, Date objects, and epoch ms equivalently", () => {
    const a = formatInZone(iso, "UTC", HOUR24)
    expect(formatInZone(new Date(iso), "UTC", HOUR24)).toBe(a)
    expect(formatInZone(Date.parse(iso), "UTC", HOUR24)).toBe(a)
  })
})
