import { Button } from "@/components/ui/button"
import type { DashboardQuickView } from "@/lib/dashboard-view"

type DashboardSummaryProps = {
  counts: { overdue: number; dueSoon: number; ongoing: number; completed: number }
  value: DashboardQuickView
  onChange: (value: DashboardQuickView) => void
}

export function DashboardSummary({ counts, value, onChange }: DashboardSummaryProps) {
  return (
    <section aria-label="Assignment summary" className="grid gap-2 sm:grid-cols-4">
      <Button
        variant={value === "all" ? "secondary" : "outline"}
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
      >
        All work
      </Button>
      <Button
        variant={value === "attention" ? "secondary" : "outline"}
        aria-pressed={value === "attention"}
        onClick={() => onChange("attention")}
      >
        <span>Needs attention</span>
        <span className="flex gap-2 text-xs">
          <span>Overdue {counts.overdue}</span>
          <span>Due soon {counts.dueSoon}</span>
        </span>
      </Button>
      <Button
        variant={value === "ongoing" ? "secondary" : "outline"}
        aria-pressed={value === "ongoing"}
        onClick={() => onChange("ongoing")}
      >
        <span>Ongoing</span><span>{counts.ongoing}</span>
      </Button>
      <Button
        variant={value === "completed" ? "secondary" : "outline"}
        aria-pressed={value === "completed"}
        onClick={() => onChange("completed")}
      >
        <span>Completed</span><span>{counts.completed}</span>
      </Button>
    </section>
  )
}
