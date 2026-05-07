"use client"

import { Icon } from "@/components/icons"

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      <Icon name="external" size={13} /> <span>{label}</span>
    </button>
  )
}
