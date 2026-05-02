"use client"

import { createContext, useContext } from "react"
import {
  convert,
  formatMoney,
  formatMoneyConverted,
  sumInDisplayCurrency,
  type FxRates,
} from "./money"

type Ctx = {
  /** ISO code the user wants everything aggregated into (USD by default). */
  displayCurrency: string
  rates: FxRates
  /** Format `amount` in `currency`, no conversion. */
  format: (amount: number, currency?: string, opts?: { signed?: boolean }) => string
  /** Convert `amount` from `currency` → displayCurrency, then format. */
  formatInDisplay: (amount: number, currency: string, opts?: { signed?: boolean }) => { display: string; converted: boolean }
  /** Sum mixed-currency rows in displayCurrency; surfaces missing-rate currencies. */
  sumInDisplay: (rows: Array<{ amount: number; currency: string }>) => { total: number; missingRates: string[] }
  /** Raw rate lookup. */
  rate: (from: string, to: string) => number | null
}

const MoneyContext = createContext<Ctx | null>(null)

export function MoneyProvider({
  displayCurrency,
  rates,
  children,
}: {
  displayCurrency: string
  rates: FxRates
  children: React.ReactNode
}) {
  const value: Ctx = {
    displayCurrency,
    rates,
    format: (amount, currency = "USD", opts) => formatMoney(amount, currency, opts),
    formatInDisplay: (amount, currency, opts) =>
      formatMoneyConverted(amount, currency, displayCurrency, rates, opts),
    sumInDisplay: (rows) => sumInDisplayCurrency(rows, displayCurrency, rates),
    rate: (from, to) => {
      const r = convert(1, from, to, rates)
      return r ? r.value : null
    },
  }
  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
}

export function useMoney() {
  const ctx = useContext(MoneyContext)
  if (!ctx) {
    // Safe default for trees not yet wrapped — USD only, no conversion.
    return {
      displayCurrency: "USD",
      rates: {} as FxRates,
      format: (amount: number, currency = "USD", opts?: { signed?: boolean }) =>
        formatMoney(amount, currency, opts),
      formatInDisplay: (amount: number, currency: string, opts?: { signed?: boolean }) =>
        formatMoneyConverted(amount, currency, "USD", {}, opts),
      sumInDisplay: (rows: Array<{ amount: number; currency: string }>) =>
        sumInDisplayCurrency(rows, "USD", {}),
      rate: () => null as number | null,
    }
  }
  return ctx
}
