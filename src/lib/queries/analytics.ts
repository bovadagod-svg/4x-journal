import { createClient } from "@/lib/supabase/server"
import { getCurrentScope } from "./scope"

export type OverallStats = {
  totalTrades: number
  closedTrades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number | null
  avgR: number | null
  avgWinR: number | null
  avgLossR: number | null
  totalPnL: number
  profitFactor: number | null
  expectancy: number | null
  maxDrawdown: number | null
  sharpe: number | null
  bestPair: { pair: string; pnl: number } | null
  worstPair: { pair: string; pnl: number } | null
}

export type EquityPoint = { date: string; equity: number; tradeId: string }
export type PairPerformance = { pair: string; trades: number; closedTrades: number; winRate: number | null; pnl: number; avgR: number | null }

type ClosedTrade = {
  id: string
  pair: string
  pnl: number
  r: number
  closed_at: string
}

type RangeOpts = { from?: string | null; to?: string | null }

async function fetchClosed(opts: RangeOpts = {}): Promise<ClosedTrade[]> {
  const supabase = await createClient()
  const scope = await getCurrentScope()
  let q = supabase
    .from("trades")
    .select("id, pair, pnl, r, closed_at")
    .eq("status", "closed")
    .order("closed_at", { ascending: true })
  if (scope !== "all") q = q.eq("account_id", scope)
  if (opts.from) q = q.gte("closed_at", opts.from)
  if (opts.to) q = q.lte("closed_at", opts.to)
  const { data } = await q
  return (data ?? [])
    .filter((t): t is typeof t & { closed_at: string } => t.closed_at != null)
    .map((t) => ({
      id: t.id,
      pair: t.pair,
      pnl: Number(t.pnl) || 0,
      r: Number(t.r) || 0,
      closed_at: t.closed_at,
    }))
}

export async function getEquityCurve(opts: RangeOpts = {}): Promise<EquityPoint[]> {
  const trades = await fetchClosed(opts)
  let equity = 0
  return trades.map((t) => {
    equity += t.pnl
    return { date: t.closed_at, equity: Number(equity.toFixed(2)), tradeId: t.id }
  })
}

export async function getPairPerformance(opts: RangeOpts = {}): Promise<PairPerformance[]> {
  const supabase = await createClient()
  const scope = await getCurrentScope()
  let q = supabase.from("trades").select("pair, status, pnl, r, closed_at")
  if (scope !== "all") q = q.eq("account_id", scope)
  if (opts.from) q = q.gte("closed_at", opts.from)
  if (opts.to) q = q.lte("closed_at", opts.to)
  const { data } = await q

  const byPair = new Map<string, { trades: number; closedTrades: number; wins: number; pnl: number; rSum: number }>()
  ;(data ?? []).forEach((t) => {
    const key = t.pair
    let s = byPair.get(key)
    if (!s) { s = { trades: 0, closedTrades: 0, wins: 0, pnl: 0, rSum: 0 }; byPair.set(key, s) }
    s.trades += 1
    if (t.status === "closed") {
      s.closedTrades += 1
      const pnl = Number(t.pnl) || 0
      const r = Number(t.r) || 0
      s.pnl += pnl
      s.rSum += r
      if (pnl > 0) s.wins += 1
    }
  })

  return Array.from(byPair.entries())
    .map(([pair, s]) => ({
      pair,
      trades: s.trades,
      closedTrades: s.closedTrades,
      winRate: s.closedTrades > 0 ? Math.round((s.wins / s.closedTrades) * 100) : null,
      pnl: Number(s.pnl.toFixed(2)),
      avgR: s.closedTrades > 0 ? Number((s.rSum / s.closedTrades).toFixed(2)) : null,
    }))
    .sort((a, b) => b.pnl - a.pnl)
}

export async function getOverallStats(opts: RangeOpts = {}): Promise<OverallStats> {
  const supabase = await createClient()
  const scope = await getCurrentScope()
  let q = supabase.from("trades").select("status, pair, pnl, r, closed_at")
  if (scope !== "all") q = q.eq("account_id", scope)
  if (opts.from) q = q.gte("closed_at", opts.from)
  if (opts.to) q = q.lte("closed_at", opts.to)
  const { data } = await q
  const all = data ?? []

  const closed = all.filter((t) => t.status === "closed").map((t) => ({
    pair: t.pair,
    pnl: Number(t.pnl) || 0,
    r: Number(t.r) || 0,
    closed_at: t.closed_at,
  }))

  const wins = closed.filter((t) => t.pnl > 0)
  const losses = closed.filter((t) => t.pnl < 0)
  const breakeven = closed.length - wins.length - losses.length

  const sumWins = wins.reduce((s, t) => s + t.pnl, 0)
  const sumLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const totalPnL = closed.reduce((s, t) => s + t.pnl, 0)

  const avgR = closed.length > 0
    ? Number((closed.reduce((s, t) => s + t.r, 0) / closed.length).toFixed(3))
    : null
  const avgWinR = wins.length > 0
    ? Number((wins.reduce((s, t) => s + t.r, 0) / wins.length).toFixed(3))
    : null
  const avgLossR = losses.length > 0
    ? Number((losses.reduce((s, t) => s + t.r, 0) / losses.length).toFixed(3))
    : null

  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : null

  const profitFactor = sumLosses > 0
    ? Number((sumWins / sumLosses).toFixed(2))
    : sumWins > 0 ? null : null
  // Expectancy in R per trade.
  const expectancy = winRate != null && avgWinR != null && avgLossR != null
    ? Number(((winRate / 100) * avgWinR + (1 - winRate / 100) * avgLossR).toFixed(3))
    : avgR

  // Equity curve and metrics that depend on it.
  let runningEquity = 0
  const equityPoints = closed
    .filter((t): t is typeof t & { closed_at: string } => t.closed_at != null)
    .sort((a, b) => a.closed_at.localeCompare(b.closed_at))
    .map((t) => {
      runningEquity += t.pnl
      return runningEquity
    })

  // Max drawdown — peak-to-trough decline expressed as % of peak.
  let peak = 0
  let maxDD = 0
  for (const v of equityPoints) {
    if (v > peak) peak = v
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }
  const maxDrawdown = closed.length >= 5 ? Number(maxDD.toFixed(2)) : null

  // Sharpe — mean / stdev of per-trade R, scaled. Simple proxy until we
  // have daily returns. Requires ≥ 5 trades to be meaningful.
  let sharpe: number | null = null
  if (closed.length >= 5) {
    const rs = closed.map((t) => t.r)
    const mean = rs.reduce((s, x) => s + x, 0) / rs.length
    const variance = rs.reduce((s, x) => s + (x - mean) ** 2, 0) / rs.length
    const stdev = Math.sqrt(variance)
    if (stdev > 0) sharpe = Number((mean / stdev).toFixed(2))
  }

  // Best / worst pair by P&L.
  const byPair = new Map<string, number>()
  closed.forEach((t) => byPair.set(t.pair, (byPair.get(t.pair) ?? 0) + t.pnl))
  const sortedPairs = Array.from(byPair.entries()).sort((a, b) => b[1] - a[1])
  const bestPair = sortedPairs[0] ? { pair: sortedPairs[0][0], pnl: Number(sortedPairs[0][1].toFixed(2)) } : null
  const worstPair = sortedPairs.length > 1
    ? { pair: sortedPairs[sortedPairs.length - 1][0], pnl: Number(sortedPairs[sortedPairs.length - 1][1].toFixed(2)) }
    : null

  return {
    totalTrades: all.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate,
    avgR,
    avgWinR,
    avgLossR,
    totalPnL: Number(totalPnL.toFixed(2)),
    profitFactor,
    expectancy,
    maxDrawdown,
    sharpe,
    bestPair,
    worstPair,
  }
}
