// Pure module — safe to import from client components.

export const PLAYBOOK_TEMPLATES: Array<{ name: string; color: string; notes: string; target_r: number }> = [
  {
    name: "London Breakout",
    color: "#4312A0",
    target_r: 2,
    notes: "Wait for Asia high/low. Enter on break with momentum + retest. Stop below structure. Scale at 1R, trail to BE. Skip if news within 30 min.",
  },
  {
    name: "Liquidity Sweep",
    color: "#BE333D",
    target_r: 2.5,
    notes: "Identify obvious resting liquidity (equal highs/lows). Wait for sweep + reversal candle. Enter on retest of swept level. Stop beyond extreme of sweep.",
  },
  {
    name: "Order Block",
    color: "#11C458",
    target_r: 3,
    notes: "Mark last opposing candle before strong impulsive move. Wait for return to OB. Look for rejection + lower-timeframe shift. Stop beyond OB extreme.",
  },
  {
    name: "FVG Retest",
    color: "#E5A23B",
    target_r: 2,
    notes: "Mark fair-value gaps on impulse legs. Wait for price to fill 50% of gap. Look for reaction candle. Stop beyond gap extreme. Target prior swing.",
  },
]
