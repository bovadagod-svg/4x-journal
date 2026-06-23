import { describe, it, expect } from "vitest"
import { classifyOutcome, isWin, isLoss, isBreakeven, winRatePct, BREAKEVEN_THRESHOLD } from "./outcome"

describe("classifyOutcome — ±$100 scratch zone", () => {
  it("treats |pnl| <= 100 as breakeven (inclusive at the boundary)", () => {
    expect(classifyOutcome(0)).toBe("breakeven")
    expect(classifyOutcome(100)).toBe("breakeven")
    expect(classifyOutcome(-100)).toBe("breakeven")
    expect(classifyOutcome(99.99)).toBe("breakeven")
    expect(classifyOutcome(-50)).toBe("breakeven")
  })

  it("counts a win only above +$100", () => {
    expect(classifyOutcome(100.01)).toBe("win")
    expect(classifyOutcome(250)).toBe("win")
  })

  it("counts a loss only below -$100", () => {
    expect(classifyOutcome(-100.01)).toBe("loss")
    expect(classifyOutcome(-5000)).toBe("loss")
  })

  it("returns null for unknown P&L (open trades)", () => {
    expect(classifyOutcome(null)).toBeNull()
    expect(classifyOutcome(undefined)).toBeNull()
    expect(classifyOutcome(NaN)).toBeNull()
  })

  it("boundary constant is 100", () => {
    expect(BREAKEVEN_THRESHOLD).toBe(100)
  })

  it("predicates agree with classifyOutcome and are mutually exclusive", () => {
    for (const pnl of [-5000, -100.01, -100, -1, 0, 1, 100, 100.01, 5000]) {
      const flags = [isWin(pnl), isLoss(pnl), isBreakeven(pnl)].filter(Boolean)
      expect(flags).toHaveLength(1)
      expect(classifyOutcome(pnl)).toBe(isWin(pnl) ? "win" : isLoss(pnl) ? "loss" : "breakeven")
    }
  })
})

describe("winRatePct — breakevens excluded", () => {
  it("divides wins by decisive trades (wins + losses)", () => {
    // 5 wins, 3 losses, 4 breakevens -> 5/8 = 63%
    expect(winRatePct(5, 3)).toBe(63)
  })
  it("is 100 with no losses and 0 with no wins", () => {
    expect(winRatePct(4, 0)).toBe(100)
    expect(winRatePct(0, 4)).toBe(0)
  })
  it("is null when there are no decisive trades (all breakevens / none)", () => {
    expect(winRatePct(0, 0)).toBeNull()
  })
})
