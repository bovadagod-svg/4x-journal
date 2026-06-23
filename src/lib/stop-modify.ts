/**
 * Shared SL/TP modification reconstruction — used by both the analytics
 * "Stop & Target Behavior" card (aggregate counts) and the trade detail
 * drawer's Lifecycle tab (per-event movement labels).
 *
 * TradeLocker (and similar brokers) do NOT emit "Replaced"/"Modified" events
 * carrying the new stopLoss/takeProfit — those fields only ever sit on the
 * opening order. Instead, each SL/TP a trader sets is a protective *exit* order
 * (isOpen=false) whose trigger price IS the level: a Stop order carries the SL,
 * a Limit order carries the TP. Adjusting an SL/TP cancels the old protective
 * order and creates a new one, so the chronological sequence of protective-order
 * prices — seeded by the opener's initial SL/TP — is the real modification
 * timeline. Market exits are the close itself, not a level, and are ignored.
 *
 * Each step is classified BE / Trail / Loose (SL) or Wider / Tighter (TP)
 * relative to the previous level, with a 5bp-of-entry-price noise floor so a
 * protective limit sitting a hair off the round TP isn't miscounted as an
 * adjustment. Explicit "Replaced" events (other brokers) feed the same path.
 */

export type StopTargetEvent = {
  occurredAt?: string
  status?: string
  /** Normalized order type — "Stop" (SL order), "Limit" (TP order), "Market", … */
  type?: string | null
  /** true = opening/scale-in order; false = closing/protective order. */
  isOpen?: boolean | null
  /** Order trigger/limit price. For protective Stop/Limit orders this is the SL/TP level. */
  price?: number | null
  /** Only populated on the opening order — the trade's initial SL/TP. */
  stopLoss?: number | null
  takeProfit?: number | null
}

export type SlClass = "be" | "trail" | "loose"
export type TpClass = "wider" | "tighter"

export type StopTargetMove<T> = {
  event: T
  slClass?: SlClass
  /** Signed change in SL vs the previous level (only set when a move was counted). */
  slDelta?: number
  /** Running SL level as of this event (seeded from the opener). */
  slLevel: number | null
  tpClass?: TpClass
  tpDelta?: number
  tpLevel: number | null
}

export type StopTargetCounts = {
  slMoves: number
  slBe: number
  slTrail: number
  slLoose: number
  tpMoves: number
  tpWider: number
  tpTighter: number
}

export type StopTargetAnalysis<T> = {
  /** One entry per event, chronological (oldest → newest). */
  annotated: StopTargetMove<T>[]
  counts: StopTargetCounts
  /** Last known SL / TP level after walking the whole lifecycle. */
  finalSL: number | null
  finalTP: number | null
}

export function classifyStopTargetMoves<T extends StopTargetEvent>(
  events: T[],
  ctx: { side: "long" | "short"; entryPrice: number },
): StopTargetAnalysis<T> {
  const chrono = [...events].sort(
    (a, b) => new Date(a.occurredAt ?? 0).getTime() - new Date(b.occurredAt ?? 0).getTime(),
  )

  // Seed the running levels from the opening order's initial SL/TP.
  let prevSL: number | null = null
  let prevTP: number | null = null
  for (const e of chrono) {
    if (e.isOpen === true) {
      if (e.stopLoss != null) prevSL = e.stopLoss
      if (e.takeProfit != null) prevTP = e.takeProfit
      break
    }
  }

  const scale = Math.abs(ctx.entryPrice)
  const changeEps = scale > 0 ? scale * 0.0005 : 0
  const beThreshold = scale * 0.0001

  const counts: StopTargetCounts = {
    slMoves: 0, slBe: 0, slTrail: 0, slLoose: 0, tpMoves: 0, tpWider: 0, tpTighter: 0,
  }

  const annotated = chrono.map((e): StopTargetMove<T> => {
    const move: StopTargetMove<T> = { event: e, slLevel: prevSL, tpLevel: prevTP }

    const status = (e.status ?? "").toLowerCase()
    const isReplaced = status.includes("replac") || status.includes("modif")
    const type = (e.type ?? "").toLowerCase()
    const isExit = e.isOpen === false

    // The SL/TP level this event carries (if any): an explicit Replaced value,
    // else the trigger price of a protective Stop (SL) / Limit (TP) exit order.
    let newSL: number | null = null
    let newTP: number | null = null
    if (isReplaced && e.stopLoss != null) newSL = e.stopLoss
    else if (isExit && type === "stop" && e.price != null) newSL = e.price
    if (isReplaced && e.takeProfit != null) newTP = e.takeProfit
    else if (isExit && type === "limit" && e.price != null) newTP = e.price

    if (newSL != null) {
      if (prevSL == null) {
        prevSL = newSL // first known SL becomes the baseline (no movement counted)
      } else if (Math.abs(newSL - prevSL) > changeEps) {
        counts.slMoves++
        move.slDelta = newSL - prevSL
        if (Math.abs(newSL - ctx.entryPrice) <= beThreshold) {
          move.slClass = "be"; counts.slBe++
        } else if (ctx.side === "long" ? newSL > prevSL : newSL < prevSL) {
          move.slClass = "trail"; counts.slTrail++
        } else {
          move.slClass = "loose"; counts.slLoose++
        }
        prevSL = newSL
      }
    }
    if (newTP != null) {
      if (prevTP == null) {
        prevTP = newTP
      } else if (Math.abs(newTP - prevTP) > changeEps) {
        counts.tpMoves++
        move.tpDelta = newTP - prevTP
        if (ctx.side === "long" ? newTP > prevTP : newTP < prevTP) {
          move.tpClass = "wider"; counts.tpWider++
        } else {
          move.tpClass = "tighter"; counts.tpTighter++
        }
        prevTP = newTP
      }
    }

    move.slLevel = prevSL
    move.tpLevel = prevTP
    return move
  })

  return { annotated, counts, finalSL: prevSL, finalTP: prevTP }
}
