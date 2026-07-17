import { describe, expect, it } from "vitest"

import {
  deriveDashboardView,
  getDashboardSummary,
  isAssignmentDueSoon,
  isAssignmentOverdue,
} from "@/lib/dashboard-view"
import type { Assignment } from "@/types"

const now = new Date(2026, 6, 17, 12, 0, 0)

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 1,
    userId: "user-1",
    teamId: 1,
    teamName: "UK Jobs",
    currentUserRole: "admin",
    assigneeUserId: "user-1",
    assigneeName: "Ada",
    assigneeEmail: "ada@example.com",
    title: "Assignment",
    category: "Assignment",
    priority: "medium",
    status: "not-started",
    progressStage: "ai-draft",
    dueDate: null,
    dueTime: null,
    progress: 0,
    notes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("dashboard view derivation", () => {
  it("returns zero counts and empty groups for empty input", () => {
    expect(getDashboardSummary([], now)).toEqual({
      overdue: 0,
      dueSoon: 0,
      ongoing: 0,
      completed: 0,
    })
    expect(deriveDashboardView([], "deadline", "asc")).toEqual({
      incomplete: [],
      completed: [],
      ordered: [],
    })
  })

  it("excludes missing deadlines and completed work from deadline urgency", () => {
    const missing = assignment()
    const completed = assignment({ status: "completed", dueDate: "2026-07-01" })

    expect(isAssignmentOverdue(missing, now)).toBe(false)
    expect(isAssignmentDueSoon(missing, now)).toBe(false)
    expect(isAssignmentOverdue(completed, now)).toBe(false)
    expect(isAssignmentDueSoon(completed, now)).toBe(false)
  })

  it("uses local time consistently for overdue and today's due-soon boundary", () => {
    expect(
      isAssignmentOverdue(assignment({ dueDate: "2026-07-17", dueTime: "11:59" }), now),
    ).toBe(true)
    expect(
      isAssignmentDueSoon(assignment({ dueDate: "2026-07-17", dueTime: "12:01" }), now),
    ).toBe(true)
    expect(isAssignmentOverdue(assignment({ dueDate: "2026-07-17" }), now)).toBe(false)
  })

  it("includes the end of the seventh calendar day and excludes the next day", () => {
    expect(
      isAssignmentDueSoon(assignment({ dueDate: "2026-07-24", dueTime: "23:59" }), now),
    ).toBe(true)
    expect(
      isAssignmentDueSoon(assignment({ dueDate: "2026-07-25", dueTime: "00:00" }), now),
    ).toBe(false)
  })

  it("counts overdue, due soon, ongoing, and completed independently", () => {
    const assignments = [
      assignment({ id: 1, status: "ongoing", dueDate: "2026-07-16" }),
      assignment({ id: 2, dueDate: "2026-07-20" }),
      assignment({ id: 3, status: "ongoing", dueDate: null }),
      assignment({ id: 4, status: "completed", dueDate: "2026-07-01" }),
    ]

    expect(getDashboardSummary(assignments, now)).toEqual({
      overdue: 1,
      dueSoon: 1,
      ongoing: 2,
      completed: 1,
    })
  })

  it("orders incomplete before completed while respecting the selected sort in each group", () => {
    const assignments = [
      assignment({ id: 1, title: "Zulu", status: "completed" }),
      assignment({ id: 2, title: "Bravo" }),
      assignment({ id: 3, title: "Alpha", status: "completed" }),
      assignment({ id: 4, title: "Charlie" }),
    ]

    expect(deriveDashboardView(assignments, "name", "asc").ordered.map(({ id }) => id)).toEqual([
      2, 4, 3, 1,
    ])
  })

  it("preserves input order when selected sort values are equal", () => {
    const assignments = [
      assignment({ id: 3, title: "Same" }),
      assignment({ id: 1, title: "Same" }),
      assignment({ id: 2, title: "Same" }),
    ]

    expect(deriveDashboardView(assignments, "name", "asc").ordered.map(({ id }) => id)).toEqual([
      3, 1, 2,
    ])
  })
})
