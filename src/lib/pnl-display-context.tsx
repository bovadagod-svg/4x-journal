"use client"

import { createContext, useContext } from "react"
import { formatPnL, type PnLDisplayMode, type PnLFormatOpts } from "./pnl-display"

type Ctx = {
  mode: PnLDisplayMode
  format: (opts: PnLFormatOpts) => string
  /**
   * Static label like "P&L" / "P&L (R)" / "P&L (%)" — matches whichever mode
   * is active. Use in column headers, KPI labels, etc.
   */
  label: (base?: string) => string
}

const PnLDisplayContext = createContext<Ctx | null>(null)

export function PnLDisplayProvider({
  mode,
  children,
}: {
  mode: PnLDisplayMode
  children: React.ReactNode
}) {
  const value: Ctx = {
    mode,
    format: (opts) => formatPnL(mode, opts),
    label: (base = "P&L") =>
      mode === "rmultiple" ? `${base} (R)` : mode === "percent" ? `${base} (%)` : base,
  }
  return <PnLDisplayContext.Provider value={value}>{children}</PnLDisplayContext.Provider>
}

export function usePnLDisplay() {
  const ctx = useContext(PnLDisplayContext)
  if (!ctx) {
    // Safe fallback when a tree isn't wrapped — defaults to money.
    return {
      mode: "money" as const,
      format: (opts: PnLFormatOpts) => formatPnL("money", opts),
      label: (base = "P&L") => base,
    }
  }
  return ctx
}
