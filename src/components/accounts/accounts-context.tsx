"use client"

import { createContext, useContext } from "react"
import type { Database } from "@/lib/supabase/database.types"

type Account = Database["public"]["Tables"]["accounts"]["Row"]

const AccountsContext = createContext<{ accounts: Account[] } | null>(null)

export function AccountsProvider({
  accounts,
  children,
}: {
  accounts: Account[]
  children: React.ReactNode
}) {
  return <AccountsContext.Provider value={{ accounts }}>{children}</AccountsContext.Provider>
}

export function useAccounts() {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error("useAccounts must be inside AccountsProvider")
  return ctx
}

export type { Account }
