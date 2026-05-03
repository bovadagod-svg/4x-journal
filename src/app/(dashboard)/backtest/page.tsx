import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function BacktestPage() {
  const m = SECTION_META.backtest
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub
        icon={m.icon}
        title="Backtesting · paused"
        description="A meaningful backtest needs both a deep historical-data feed and ≥100 trades on a single playbook to compare against. Until you have that sample, the Risk-of-Ruin and Monte Carlo cards on Analytics give you forward-projection from the same math — open Analytics to see them."
      />
    </>
  )
}
