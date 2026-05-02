import { describe, expect, it } from "vitest"
import { formatPnL } from "./pnl-display"

describe("formatPnL — money mode", () => {
  it("formats positive with + sign by default", () => {
    expect(formatPnL("money", { pnl: 100, r: 1, signed: true })).toBe("+$100.00")
  })
  it("formats zero", () => {
    expect(formatPnL("money", { pnl: 0, r: 0 })).toBe("$0.00")
  })
  it("returns — when pnl is null", () => {
    expect(formatPnL("money", { pnl: null, r: null })).toBe("—")
  })
})

describe("formatPnL — rmultiple mode", () => {
  it("formats positive R", () => {
    expect(formatPnL("rmultiple", { pnl: 100, r: 1.45, signed: true })).toBe("+1.45R")
  })
  it("formats negative R", () => {
    expect(formatPnL("rmultiple", { pnl: -100, r: -1, signed: true })).toBe("-1.00R")
  })
  it("returns — when r is null", () => {
    expect(formatPnL("rmultiple", { pnl: 100, r: null })).toBe("—")
  })
})

describe("formatPnL — percent mode", () => {
  it("formats percent of equity", () => {
    expect(formatPnL("percent", { pnl: 100, r: 1, equity: 10000, signed: true })).toBe("+1.00%")
  })
  it("returns — when equity is missing", () => {
    expect(formatPnL("percent", { pnl: 100, r: 1, equity: null, signed: true })).toBe("—")
  })
  it("returns — when equity is zero or negative", () => {
    expect(formatPnL("percent", { pnl: 100, r: 1, equity: 0, signed: true })).toBe("—")
    expect(formatPnL("percent", { pnl: 100, r: 1, equity: -100, signed: true })).toBe("—")
  })
})
