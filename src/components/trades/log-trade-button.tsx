"use client"

import { Icon } from "@/components/icons"
import { useLogTrade } from "./log-trade-context"

export function LogTradeButton({ label = "Log trade", primary = true, size }: { label?: string; primary?: boolean; size?: number }) {
  const { open } = useLogTrade()
  return (
    <button className={primary ? "btn btn-primary" : "btn"} onClick={open}>
      <Icon name="plus" size={size ?? 13} />
      <span>{label}</span>
    </button>
  )
}
