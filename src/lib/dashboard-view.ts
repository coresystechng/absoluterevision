import type { Assignment } from "@/types"

export type DashboardSortField = "deadline" | "name"
export type DashboardSortDirection = "asc" | "desc"

export type DashboardSummaryCounts = {
  overdue: number
  dueSoon: number
  ongoing: number
  completed: number
}

export function getAssignmentDeadline(assignment: Assignment) {
  if (!assignment.dueDate) {
    return null
  }

  const deadline = new Date(`${assignment.dueDate}T${assignment.dueTime ?? "23:59:59"}`)
  return Number.isNaN(deadline.getTime()) ? null : deadline
}

export function isAssignmentOverdue(assignment: Assignment, now = new Date()) {
  if (assignment.status === "completed") {
    return false
  }

  const deadline = getAssignmentDeadline(assignment)
  return deadline !== null && deadline.getTime() < now.getTime()
}

export function isAssignmentDueSoon(assignment: Assignment, now = new Date()) {
  if (assignment.status === "completed" || isAssignmentOverdue(assignment, now)) {
    return false
  }

  const deadline = getAssignmentDeadline(assignment)
  if (!deadline) {
    return false
  }

  const boundary = new Date(now)
  boundary.setHours(23, 59, 59, 999)
  boundary.setDate(boundary.getDate() + 7)
  return deadline.getTime() <= boundary.getTime()
}

export function getDashboardSummary(
  assignments: Assignment[],
  now = new Date(),
): DashboardSummaryCounts {
  return assignments.reduce<DashboardSummaryCounts>(
    (counts, assignment) => {
      if (isAssignmentOverdue(assignment, now)) counts.overdue += 1
      if (isAssignmentDueSoon(assignment, now)) counts.dueSoon += 1
      if (assignment.status === "ongoing") counts.ongoing += 1
      if (assignment.status === "completed") counts.completed += 1
      return counts
    },
    { overdue: 0, dueSoon: 0, ongoing: 0, completed: 0 },
  )
}

function compareAssignments(
  a: Assignment,
  b: Assignment,
  sortField: DashboardSortField,
  sortDirection: DashboardSortDirection,
) {
  const direction = sortDirection === "asc" ? 1 : -1

  if (sortField === "name") {
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) * direction
  }

  const deadlineA = getAssignmentDeadline(a)?.getTime() ?? null
  const deadlineB = getAssignmentDeadline(b)?.getTime() ?? null
  if (deadlineA === null && deadlineB === null) return 0
  if (deadlineA === null) return 1
  if (deadlineB === null) return -1
  return (deadlineA - deadlineB) * direction
}

function stableSort(
  assignments: Assignment[],
  sortField: DashboardSortField,
  sortDirection: DashboardSortDirection,
) {
  return assignments
    .map((assignment, index) => ({ assignment, index }))
    .sort(
      (a, b) =>
        compareAssignments(a.assignment, b.assignment, sortField, sortDirection) ||
        a.index - b.index,
    )
    .map(({ assignment }) => assignment)
}

export function deriveDashboardView(
  assignments: Assignment[],
  sortField: DashboardSortField,
  sortDirection: DashboardSortDirection,
) {
  const incomplete = stableSort(
    assignments.filter((assignment) => assignment.status !== "completed"),
    sortField,
    sortDirection,
  )
  const completed = stableSort(
    assignments.filter((assignment) => assignment.status === "completed"),
    sortField,
    sortDirection,
  )

  return {
    incomplete,
    completed,
    ordered: [...incomplete, ...completed],
  }
}
