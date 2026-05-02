"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { TradeDetailDrawer } from "./trade-detail-drawer"

type Ctx = {
  openTrade: (tradeId: string) => void
  close: () => void
  isOpen: boolean
}

const TradeDetailDrawerContext = createContext<Ctx | null>(null)

export function TradeDetailDrawerProvider({ children }: { children: React.ReactNode }) {
  const [tradeId, setTradeId] = useState<string | null>(null)

  const openTrade = useCallback((id: string) => setTradeId(id), [])
  const close = useCallback(() => setTradeId(null), [])

  return (
    <TradeDetailDrawerContext.Provider value={{ openTrade, close, isOpen: !!tradeId }}>
      {children}
      <TradeDetailDrawer tradeId={tradeId} onClose={close} />
    </TradeDetailDrawerContext.Provider>
  )
}

export function useTradeDetailDrawer() {
  const ctx = useContext(TradeDetailDrawerContext)
  if (!ctx) throw new Error("useTradeDetailDrawer must be inside TradeDetailDrawerProvider")
  return ctx
}
