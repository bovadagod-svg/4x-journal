import { describe, expect, it } from "vitest"
import { normalizeRows, type ColumnMap } from "./parser"

describe("normalizeRows", () => {
  const map: ColumnMap = {
    pair: "Symbol",
    side: "Type",
    entry_price: "Open",
    exit_price: "Close",
    size: "Volume",
    pnl: "Profit",
    opened_at: "OpenTime",
  }

  it("normalizes a clean MT-style row", () => {
    const rows = [{ Symbol: "EURUSD", Type: "buy", Open: "1.08412", Close: "1.08600", Volume: "0.10", Profit: "18.80", OpenTime: "2026.04.12 14:30:00" }]
    const out = normalizeRows(rows, map)
    expect(out[0].issue).toBeUndefined()
    expect(out[0].pair).toBe("EUR/USD")
    expect(out[0].side).toBe("long")
    expect(out[0].entry_price).toBe(1.08412)
    expect(out[0].exit_price).toBe(1.086)
    expect(out[0].size).toBe(0.1)
    expect(out[0].pnl).toBe(18.8)
    // OpenTime parses as ISO string
    expect(out[0].opened_at).toBeTypeOf("string")
  })

  it("flags missing pair as skipped", () => {
    const out = normalizeRows([{ Symbol: "", Type: "buy", Open: "1", Volume: "1" }], map)
    expect(out[0].issue).toBe("missing pair")
  })

  it("flags unknown side as skipped", () => {
    const out = normalizeRows([{ Symbol: "EUR/USD", Type: "wat", Open: "1", Volume: "1" }], map)
    expect(out[0].issue).toBe("unknown side")
  })

  it("flags invalid entry price", () => {
    const out = normalizeRows([{ Symbol: "EUR/USD", Type: "buy", Open: "abc", Volume: "1" }], map)
    expect(out[0].issue).toBe("invalid entry price")
  })

  it("flags zero/negative size", () => {
    const out = normalizeRows([{ Symbol: "EUR/USD", Type: "buy", Open: "1", Volume: "0" }], map)
    expect(out[0].issue).toBe("invalid size")
  })

  it("auto-inserts slash in 6-char pair", () => {
    const out = normalizeRows([{ Symbol: "GBPUSD", Type: "sell", Open: "1.265", Volume: "1" }], map)
    expect(out[0].pair).toBe("GBP/USD")
    expect(out[0].side).toBe("short")
  })

  it("normalizes XAU pairs", () => {
    const out = normalizeRows([{ Symbol: "XAUUSD", Type: "buy", Open: "2350", Volume: "0.1" }], map)
    expect(out[0].pair).toBe("XAU/USD")
  })

  it("strips currency symbols and thousands separators from numbers", () => {
    const out = normalizeRows([{ Symbol: "EUR/USD", Type: "buy", Open: "1.08", Volume: "1", Profit: "$1,234.50" }], map)
    expect(out[0].pnl).toBe(1234.5)
  })

  it("handles 'B' / 'S' as valid sides", () => {
    expect(normalizeRows([{ Symbol: "EUR/USD", Type: "B", Open: "1", Volume: "1" }], map)[0].side).toBe("long")
    expect(normalizeRows([{ Symbol: "EUR/USD", Type: "S", Open: "1", Volume: "1" }], map)[0].side).toBe("short")
  })

  it("handles '1' / '-1' as valid sides", () => {
    expect(normalizeRows([{ Symbol: "EUR/USD", Type: "1", Open: "1", Volume: "1" }], map)[0].side).toBe("long")
    expect(normalizeRows([{ Symbol: "EUR/USD", Type: "-1", Open: "1", Volume: "1" }], map)[0].side).toBe("short")
  })
})
