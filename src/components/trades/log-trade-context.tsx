"use client"

import { createContext, useContext, useState } from "react"
import type { Database } from "@/lib/supabase/database.types"
import { LogTradeModal } from "./log-trade-modal"

type Account = Database["public"]["Tables"]["accounts"]["Row"]
type Playbook = Pick<Database["public"]["Tables"]["playbooks"]["Row"], "id" | "name" | "color" | "target_r">

type Ctx = { open: () => void; close: () => void; isOpen: boolean }

const LogTradeContext = createContext<Ctx | null>(null)

export function LogTradeProvider({
  accounts,
  playbooks,
  defaultAccountId,
  children,
}: {
  accounts: Account[]
  playbooks: Playbook[]
  defaultAccountId: string | null
  children: React.ReactNode
}) {
  const [isOpen, setOpen] = useState(false)

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
