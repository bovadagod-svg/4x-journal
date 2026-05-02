"use client"

import { createContext, useCallback, useContext, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { findOrCreateEntryForTrade } from "@/lib/actions/journal-entries"
import { EntryEditorDrawer } from "./entry-editor-drawer"

type Ctx = {
  open: (entryId: string) => void
  openForTrade: (tradeId: string) => void
  close: () => void
  isOpen: boolean
}

const JournalDrawerContext = createContext<Ctx | null>(null)

export function JournalDrawerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const open = useCallback((entryId: string) => setOpenEntryId(entryId), [])
  const close = useCallback(() => {
    setOpenEntryId(null)
    router.refresh()
  }, [router])

  const openForTrade = useCallback((tradeId: string) => {
    startTransition(async () => {
      const r = await findOrCreateEntryForTrade(tradeId)
      if (r.ok) setOpenEntryId(r.id)
      else alert(r.error)
    })
  }, [])

  return (
    <JournalDrawerContext.Provider value={{ open, openForTrade, close, isOpen: !!openEntryId }}>
      {children}
      <EntryEditorDrawer entryId={openEntryId} onClose={close} />
    </JournalDrawerContext.Provider>
  )
}

export function useJournalDrawer() {
  const ctx = useContext(JournalDrawerContext)
  if (!ctx) throw new Error("useJournalDrawer must be inside JournalDrawerProvider")
  return ctx
}
