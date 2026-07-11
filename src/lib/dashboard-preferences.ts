import { assignmentStatuses } from "@/lib/assignment-status"
import { assignmentTypes } from "@/lib/assignment-types"
import type {
  AssignmentPriority,
  DashboardFilterPreferences,
} from "@/types"

const priorities: AssignmentPriority[] = ["high", "medium", "low"]

export const defaultDashboardFilters: DashboardFilterPreferences = {
  type: "all",
  priority: "all",
  status: "all",
}

export function normalizeDashboardFilters(input: {
  type?: string | null
  priority?: string | null
  status?: string | null
}): DashboardFilterPreferences {
  const type = assignmentTypes.some((item) => item.value === input.type)
    ? input.type as DashboardFilterPreferences["type"]
    : "all"
  const priority = priorities.includes(input.priority as AssignmentPriority)
    ? input.priority as AssignmentPriority
    : "all"
  const status = assignmentStatuses.some((item) => item.value === input.status)
    ? input.status as DashboardFilterPreferences["status"]
    : "all"

  return { type, priority, status }
}
