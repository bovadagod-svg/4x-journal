"use client"

import { createContext, useContext, useState } from "react"
import type { Database } from "@/lib/supabase/database.types"
import { useAccounts } from "@/components/accounts/accounts-context"
import { LogTradeModal } from "./log-trade-modal"

type Playbook = Pick<Database["public"]["Tables"]["playbooks"]["Row"], "id" | "name" | "color" | "target_r">

type Ctx = { open: () => void; close: () => void; isOpen: boolean }

const LogTradeContext = createContext<Ctx | null>(null)

export function LogTradeProvider({
  playbooks,
  children,
}: {
  playbooks: Playbook[]
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
      />
    </LogTradeContext.Provider>
  )
}

export function useLogTrade() {
  const ctx = useContext(LogTradeContext)
  if (!ctx) throw new Error("useLogTrade must be inside LogTradeProvider")
  return ctx
}
