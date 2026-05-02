"use client"

import { createContext, useContext, useState } from "react"
import type { Database } from "@/lib/supabase/database.types"
import { useAccounts } from "@/components/accounts/accounts-context"
import { LogTradeModal } from "./log-trade-modal"

type Playbook = Pick<Database["public"]["Tables"]["playbooks"]["Row"], "id" | "name" | "color" | "target_r">

type Ctx = { open: () => void; close: () => void; isOpen: boolean }

export type NewsAvoidanceEvent = {
  id: string
  currency: string
  event: string
  impact: string
  scheduled_at: string
}

export type AccountRiskCap = {
  /** Hard $ cap per trade — null if unset on the account's risk_rules row */
  max_risk_per_trade_usd: number | null
  /** % cap × equity — null if unset */
  max_risk_per_trade_pct: number | null
}

export type TradeDefaults = {
  sizing_method: "fixed-risk" | "fixed-lots" | "kelly" | "volatility-scaled"
  default_risk_pct: number
  default_fixed_lots: number
  default_playbook_id: string | null
  require_journal_note: boolean
  require_journal_mood: boolean
  /** Risk-as-%-of-equity threshold above which a confirm dialog fires. */
  confirm_above_pct: number
  /**
   * When true, the suggested risk amount in the Log Trade modal never exceeds
   * the active account's `max_risk_per_trade_*` rule values. Hard caps in
   * risk_rules still block submission server-side regardless of this flag.
   */
  cap_by_prop_rule: boolean
  /** Per-account risk caps, keyed by account_id. Null entries mean no rule set. */
  account_risk_caps: Record<string, AccountRiskCap>
  /**
   * News-avoidance context. Server has already filtered down to high-impact
   * events whose blocked window overlaps `now`. Modal just needs to match by
   * pair currencies on submit.
   */
  news_avoidance: {
    enabled: boolean
    events: NewsAvoidanceEvent[]
  }
}

const LogTradeContext = createContext<Ctx | null>(null)

export function LogTradeProvider({
  playbooks,
  defaults,
  children,
}: {
  playbooks: Playbook[]
  defaults: TradeDefaults
  children: React.ReactNode
}) {
  const { accounts } = useAccounts()
  const [isOpen, setOpen] = useState(false)
  const defaultAccountId = accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null

  return (
    <LogTradeContext.Provider value={{ open: () => setOpen(true), close: () => setOpen(false), isOpen }}>
      {children}
      <LogTradeModal
        open={isOpen}
        onClose={() => setOpen(false)}
        accounts={accounts}
        playbooks={playbooks}
        defaultAccountId={defaultAccountId}
        defaults={defaults}
      />
    </LogTradeContext.Provider>
  )
}

export function useLogTrade() {
  const ctx = useContext(LogTradeContext)
  if (!ctx) throw new Error("useLogTrade must be inside LogTradeProvider")
  return ctx
}
