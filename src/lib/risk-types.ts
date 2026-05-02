// Pure module — safe to import from client components.
// Server-only logic (queries, evaluator) lives in `./risk.ts`.

import type { Database } from "@/lib/supabase/database.types"

export type RiskRule = Database["public"]["Tables"]["risk_rules"]["Row"]

export const PROP_FIRM_TEMPLATES = [
  {
    key: "funderpro_100k",
    label: "FunderPro $100K (Phase 1)",
    rules: { max_risk_per_trade_pct: 1, daily_loss_limit_pct: 5, max_open_positions: 5 },
  },
  {
    key: "ftmo_100k",
    label: "FTMO $100K Challenge",
    rules: { max_risk_per_trade_pct: 1, daily_loss_limit_pct: 5, max_open_positions: 10 },
  },
  {
    key: "myforexfunds_100k",
    label: "MyForexFunds $100K",
    rules: { max_risk_per_trade_pct: 2, daily_loss_limit_pct: 5, max_open_positions: 10 },
  },
  {
    key: "personal_strict",
    label: "Personal · Strict",
    rules: { max_risk_per_trade_pct: 0.5, daily_loss_limit_pct: 2, max_open_positions: 3 },
  },
  {
    key: "personal_loose",
    label: "Personal · Loose",
    rules: { max_risk_per_trade_pct: 2, daily_loss_limit_pct: 10, max_open_positions: 10 },
  },
] as const
