import { assignmentStatuses } from "@/lib/assignment-status"
import { assignmentTypes, normalizeAssignmentType } from "@/lib/assignment-types"
import type {
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  AssignmentType,
  DashboardFilterPreferences,
} from "@/types"

const priorities: AssignmentPriority[] = ["high", "medium", "low"]
const types = assignmentTypes.map((item) => item.value)
const statuses = assignmentStatuses.map((item) => item.value)

export const defaultDashboardFilters: DashboardFilterPreferences = {
  types: [],
  priorities: [],
  statuses: [],
}

export function normalizeDashboardFilters(input: {
  types?: unknown
  priorities?: unknown
  statuses?: unknown
  type?: string | null
  priority?: string | null
  status?: string | null
}): DashboardFilterPreferences {
  return {
    types: normalizeSelection(input.types, input.type, types),
    priorities: normalizeSelection(input.priorities, input.priority, priorities),
    statuses: normalizeSelection(input.statuses, input.status, statuses),
  }
}

function normalizeSelection<T extends string>(
  value: unknown,
  legacyValue: string | null | undefined,
  options: T[],
) {
  const candidates = Array.isArray(value)
    ? value
    : legacyValue && legacyValue !== "all"
      ? [legacyValue]
      : []
  const normalized = options.filter((option) => candidates.includes(option))

  return normalized.length === options.length ? [] : normalized
}

export function matchesDashboardFilters(
  filters: DashboardFilterPreferences,
  assignment: Assignment,
) {
  const assignmentType = normalizeAssignmentType(assignment.category)

  return (
    matchesSelection<AssignmentType>(filters.types, assignmentType) &&
    matchesSelection<AssignmentPriority>(filters.priorities, assignment.priority) &&
    matchesSelection<AssignmentStatus>(filters.statuses, assignment.status)
  )
}

function matchesSelection<T extends string>(selection: T[], value: T) {
  return selection.length === 0 || selection.includes(value)
}
