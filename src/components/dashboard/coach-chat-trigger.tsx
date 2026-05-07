"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"
import { CoachChatDrawer } from "./coach-chat-drawer"

/**
 * Floating "Ask Coach" button — bottom-right corner of the dashboard.
 * Opens the chat drawer. Hidden on mobile widths to avoid overlapping the
 * navigation toolbar.
 */
export function CoachChatTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ask Coach AI about your trading data"
        style={{
          position: "fixed",
          right: 22, bottom: 22,
          zIndex: 50,
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px",
          borderRadius: 999,
          background: "linear-gradient(135deg, #4312A0, #6932D4)",
          color: "white",
          border: "none",
          fontSize: 12.5, fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(67, 18, 160, 0.45)",
        }}
      >
        <Icon name="sparkle" size={14} color="#fff" />
        <span>Ask Coach</span>
      </button>
      <CoachChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
