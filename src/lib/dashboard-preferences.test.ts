import { describe, expect, it } from "vitest"

import {
  defaultDashboardFilters,
  normalizeDashboardFilters,
} from "@/lib/dashboard-preferences"
import { assignmentStatuses } from "@/lib/assignment-status"
import { assignmentTypes } from "@/lib/assignment-types"

describe("dashboard filter preferences", () => {
  it("defaults every filter to all", () => {
    expect(defaultDashboardFilters).toEqual({
      type: "all",
      priority: "all",
      status: "all",
    })
    expect(normalizeDashboardFilters({})).toEqual(defaultDashboardFilters)
  })

  it("normalizes invalid stored values to all", () => {
    expect(
      normalizeDashboardFilters({
        type: "Unknown",
        priority: "urgent",
        status: "archived",
      }),
    ).toEqual(defaultDashboardFilters)
  })

  it.each(assignmentTypes)("preserves the $value assignment type", ({ value }) => {
    expect(normalizeDashboardFilters({ type: value }).type).toBe(value)
  })

  it.each(["high", "medium", "low"] as const)(
    "preserves the %s priority",
    (priority) => {
      expect(normalizeDashboardFilters({ priority }).priority).toBe(priority)
    },
  )

  it.each(assignmentStatuses)("preserves the $value status", ({ value }) => {
    expect(normalizeDashboardFilters({ status: value }).status).toBe(value)
  })
})
