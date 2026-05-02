import { describe, expect, it } from "vitest"
import { convert, formatMoney, formatMoneyConverted, sumInDisplayCurrency, parseFxRates } from "./money"

describe("convert", () => {
  it("returns same value when from === to", () => {
    expect(convert(100, "USD", "USD", {})).toEqual({ value: 100, wasConverted: false })
  })
  it("uses direct rate when present", () => {
    expect(convert(100, "USD", "GBP", { "USD->GBP": 0.79 })).toEqual({ value: 79, wasConverted: true })
  })
  it("derives reciprocal when only reverse rate exists", () => {
    expect(convert(100, "GBP", "USD", { "USD->GBP": 0.5 })).toEqual({ value: 200, wasConverted: true })
  })
  it("returns null when no rate available cross-currency", () => {
    expect(convert(100, "USD", "EUR", {})).toBeNull()
  })
  it("ignores zero or negative rate", () => {
    expect(convert(100, "USD", "GBP", { "USD->GBP": 0 })).toBeNull()
    expect(convert(100, "USD", "GBP", { "USD->GBP": -1 })).toBeNull()
  })
  it("upper-cases input currency codes", () => {
    expect(convert(100, "usd", "gbp", { "USD->GBP": 0.5 })).toEqual({ value: 50, wasConverted: true })
  })
})

describe("formatMoney", () => {
  it("formats USD by default", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50")
  })
  it("formats EUR", () => {
    expect(formatMoney(1234.5, "EUR")).toBe("€1,234.50")
  })
  it("includes + sign on positive when signed", () => {
    expect(formatMoney(1234.5, "USD", { signed: true })).toBe("+$1,234.50")
  })
})

describe("sumInDisplayCurrency", () => {
  it("sums same-currency rows without conversion", () => {
    const result = sumInDisplayCurrency(
      [{ amount: 100, currency: "USD" }, { amount: 50, currency: "USD" }],
      "USD",
      {},
    )
    expect(result.total).toBe(150)
    expect(result.missingRates).toEqual([])
  })
  it("converts mixed currencies when rates exist", () => {
    const result = sumInDisplayCurrency(
      [{ amount: 100, currency: "USD" }, { amount: 100, currency: "GBP" }],
      "USD",
      { "USD->GBP": 0.5 },
    )
    expect(result.total).toBe(300) // 100 USD + 200 USD (from 100 GBP via reciprocal)
    expect(result.missingRates).toEqual([])
  })
  it("flags missing rates and skips those rows", () => {
    const result = sumInDisplayCurrency(
      [{ amount: 100, currency: "USD" }, { amount: 50, currency: "EUR" }],
      "USD",
      {},
    )
    expect(result.total).toBe(100)
    expect(result.missingRates).toEqual(["EUR"])
  })
})

describe("formatMoneyConverted", () => {
  it("falls back to source currency when rate is missing", () => {
    const r = formatMoneyConverted(100, "GBP", "USD", {})
    expect(r.converted).toBe(false)
    expect(r.display).toBe("£100.00")
  })
  it("converts and formats in display currency when rate exists", () => {
    const r = formatMoneyConverted(100, "GBP", "USD", { "USD->GBP": 0.5 })
    expect(r.converted).toBe(true)
    expect(r.display).toBe("$200.00")
  })
})

describe("parseFxRates", () => {
  it("returns empty object on null/undefined", () => {
    expect(parseFxRates(null)).toEqual({})
    expect(parseFxRates(undefined)).toEqual({})
  })
  it("strips invalid keys", () => {
    expect(parseFxRates({ "USD->GBP": 0.79, "garbage": 1.5 })).toEqual({ "USD->GBP": 0.79 })
  })
  it("strips non-positive numbers and non-numbers", () => {
    expect(parseFxRates({ "USD->GBP": 0.79, "USD->EUR": 0, "USD->JPY": "not a number" })).toEqual({ "USD->GBP": 0.79 })
  })
})
