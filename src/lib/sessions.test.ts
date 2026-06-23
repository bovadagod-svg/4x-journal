import { describe, expect, it } from "vitest"
import {
  FX_SESSIONS,
  SESSION,
  inWindow,
  isWeekendClosed,
  marketStatusAt,
  openSessionsAt,
  sessionLabelForInstant,
  utcHour,
} from "./sessions"

/** A UTC instant. Month is 1-based for readability. */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min))

describe("calendar assumptions", () => {
  // The session tests pick specific June 2026 dates; assert their weekdays so a
  // wrong assumption fails here (loudly) rather than silently skewing a case.
  it("June 2026 dates fall on the expected weekdays", () => {
    expect(at(2026, 6, 17, 12).getUTCDay()).toBe(3) // Wednesday
    expect(at(2026, 6, 19, 12).getUTCDay()).toBe(5) // Friday
    expect(at(2026, 6, 20, 12).getUTCDay()).toBe(6) // Saturday
    expect(at(2026, 6, 21, 12).getUTCDay()).toBe(0) // Sunday
  })
})

describe("inWindow", () => {
  it("handles same-day windows (open inclusive, close exclusive)", () => {
    expect(inWindow(14, 8, 17)).toBe(true)
    expect(inWindow(8, 8, 17)).toBe(true)
    expect(inWindow(17, 8, 17)).toBe(false)
    expect(inWindow(7, 8, 17)).toBe(false)
  })
  it("handles windows that wrap midnight (Sydney 22→07)", () => {
    expect(inWindow(23, 22, 7)).toBe(true)
    expect(inWindow(3, 22, 7)).toBe(true)
    expect(inWindow(7, 22, 7)).toBe(false)
    expect(inWindow(12, 22, 7)).toBe(false)
  })
})

describe("isWeekendClosed", () => {
  it("is open mid-week", () => {
    expect(isWeekendClosed(at(2026, 6, 17, 12))).toBe(false)
  })
  it("closes Friday at the NY close (22:00 UTC)", () => {
    expect(isWeekendClosed(at(2026, 6, 19, 21, 59))).toBe(false)
    expect(isWeekendClosed(at(2026, 6, 19, 22, 0))).toBe(true)
  })
  it("stays closed all of Saturday", () => {
    expect(isWeekendClosed(at(2026, 6, 20, 2))).toBe(true)
    expect(isWeekendClosed(at(2026, 6, 20, 23))).toBe(true)
  })
  it("reopens Sunday at the Sydney open (22:00 UTC)", () => {
    expect(isWeekendClosed(at(2026, 6, 21, 21, 59))).toBe(true)
    expect(isWeekendClosed(at(2026, 6, 21, 22, 0))).toBe(false)
  })
})

describe("openSessionsAt", () => {
  it("returns no sessions on the weekend", () => {
    expect(openSessionsAt(at(2026, 6, 20, 14))).toEqual([])
  })
  it("returns London + New York during the overlap (14:00 UTC)", () => {
    expect(openSessionsAt(at(2026, 6, 17, 14)).map((s) => s.id)).toEqual(["london", "newyork"])
  })
  it("returns Sydney + Tokyo in the Asian session (02:00 UTC)", () => {
    expect(openSessionsAt(at(2026, 6, 17, 2)).map((s) => s.id)).toEqual(["sydney", "tokyo"])
  })
  it("has continuous weekday coverage — always at least one open session", () => {
    for (let h = 0; h < 24; h++) {
      expect(openSessionsAt(at(2026, 6, 17, h)).length).toBeGreaterThan(0)
    }
  })
})

describe("marketStatusAt", () => {
  it("labels the overlap 'London / New York'", () => {
    const s = marketStatusAt(at(2026, 6, 17, 14))
    expect(s.open).toBe(true)
    expect(s.sessionLabel).toBe("London / New York")
  })
  it("reports the weekend as closed", () => {
    const s = marketStatusAt(at(2026, 6, 20, 14))
    expect(s.open).toBe(false)
    expect(s.closedReason).toBe("Weekend")
    expect(s.sessionLabel).toBe("")
  })
})

describe("sessionLabelForInstant", () => {
  it("tags an overlap trade with both sessions", () => {
    expect(sessionLabelForInstant(at(2026, 6, 17, 14))).toBe("London / New York")
  })
  it("labels a weekend instant 'Closed'", () => {
    expect(sessionLabelForInstant(at(2026, 6, 20, 14))).toBe("Closed")
  })
})

describe("session model", () => {
  it("exposes four sessions in clock order", () => {
    expect(FX_SESSIONS.map((s) => s.id)).toEqual(["sydney", "tokyo", "london", "newyork"])
  })
  it("keeps the SESSION map in sync with the list", () => {
    expect(SESSION.london.open).toBe(8)
    expect(SESSION.london.close).toBe(17)
    expect(SESSION.newyork.close).toBe(22)
  })
})

describe("utcHour", () => {
  it("returns a fractional hour", () => {
    expect(utcHour(at(2026, 6, 17, 13, 30))).toBe(13.5)
  })
})
