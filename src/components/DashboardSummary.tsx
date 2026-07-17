import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { DashboardSummaryCounts } from "@/lib/dashboard-view"

export type DashboardQuickView = "all" | "attention" | "ongoing" | "completed"

const summaryItems = [
  { key: "overdue", label: "Overdue", view: "attention", icon: AlertTriangle },
  { key: "dueSoon", label: "Due soon", view: "attention", icon: CalendarClock },
  { key: "ongoing", label: "Ongoing", view: "ongoing", icon: CircleDot },
  { key: "completed", label: "Completed", view: "completed", icon: CheckCircle2 },
] as const

export function DashboardSummary({
  counts,
  activeView,
  onViewChange,
}: {
  counts: DashboardSummaryCounts
  activeView: DashboardQuickView
  onViewChange: (view: DashboardQuickView) => void
}) {
  return (
    <section aria-labelledby="dashboard-summary-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="dashboard-summary-heading" className="text-lg font-semibold">Work overview</h2>
        <div className="flex flex-wrap gap-2" aria-label="Quick views">
          {([
            ["all", "All work"],
            ["attention", "Needs attention"],
            ["ongoing", "In progress"],
            ["completed", "Completed"],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={activeView === value ? "default" : "outline"}
              aria-pressed={activeView === value}
              onClick={() => onViewChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryItems.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <span>
              <span className="block text-2xl font-semibold tabular-nums">{counts[key]}</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </span>
            <Icon className={key === "overdue" && counts.overdue > 0 ? "h-5 w-5 text-destructive" : "h-5 w-5 text-muted-foreground"} />
          </div>
        ))}
      </div>
    </section>
  )
}
