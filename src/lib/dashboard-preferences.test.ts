import { describe, expect, it } from "vitest"

import {
  defaultDashboardFilters,
  matchesDashboardFilters,
  normalizeDashboardFilters,
} from "@/lib/dashboard-preferences"
import type { Assignment } from "@/types"

const assignment: Assignment = {
  id: 1,
  trackingCode: "AR-000001-000002-000003-000004",
  userId: "user-1",
  teamId: 1,
  teamName: "Team",
  currentUserRole: "admin",
  assigneeUserId: "user-1",
  assigneeName: "Writer",
  assigneeEmail: "writer@example.com",
  title: "Research brief",
  category: "Assignment",
  priority: "high",
  status: "ongoing",
  progressStage: "ai-draft",
  dueDate: null,
  dueTime: null,
  progress: 15,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("dashboard filter preferences", () => {
  it("defaults every filter group to all", () => {
    expect(defaultDashboardFilters).toEqual({
      types: [],
      priorities: [],
      statuses: [],
    })
    expect(normalizeDashboardFilters({})).toEqual(defaultDashboardFilters)
  })

  it("promotes legacy scalar preferences to one-item selections", () => {
    expect(normalizeDashboardFilters({
      type: "Design",
      priority: "high",
      status: "ongoing",
    })).toEqual({
      types: ["Design"],
      priorities: ["high"],
      statuses: ["ongoing"],
    })
  })

  it("keeps valid stored selections in option order and removes invalid values", () => {
    expect(normalizeDashboardFilters({
      types: ["Presentation", "Unknown", "Design", "Design"],
      priorities: ["low", "urgent", "high"],
      statuses: ["completed", "archived", "ongoing"],
    })).toEqual({
      types: ["Design", "Presentation"],
      priorities: ["high", "low"],
      statuses: ["ongoing", "completed"],
    })
  })

  it("normalizes selecting every option back to all", () => {
    expect(normalizeDashboardFilters({
      types: ["Design", "Copywriting", "Dissertation", "Assignment", "Presentation"],
      priorities: ["high", "medium", "low"],
      statuses: ["not-started", "ongoing", "completed"],
    })).toEqual(defaultDashboardFilters)
  })

  it("uses OR within a group and AND across groups", () => {
    const filters = normalizeDashboardFilters({
      priorities: ["high"],
      statuses: ["not-started", "ongoing"],
    })

    expect(matchesDashboardFilters(filters, assignment)).toBe(true)
    expect(matchesDashboardFilters(filters, { ...assignment, status: "not-started" })).toBe(true)
    expect(matchesDashboardFilters(filters, { ...assignment, status: "completed" })).toBe(false)
    expect(matchesDashboardFilters(filters, { ...assignment, priority: "medium" })).toBe(false)
  })
})
