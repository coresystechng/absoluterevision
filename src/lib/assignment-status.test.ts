import { describe, expect, it } from "vitest"

import {
  assignmentProgressStages,
  getAssignmentProgress,
  getAssignmentProgressLabel,
  normalizeAssignmentProgressStage,
  normalizeAssignmentStatus,
} from "@/lib/assignment-status"

describe("assignment status helpers", () => {
  it.each([
    ["in-progress", "ongoing"],
    ["ai-plagiarism-check", "ongoing"],
    ["done", "completed"],
    ["unexpected", "not-started"],
  ] as const)("normalizes legacy status %s", (legacy, expected) => {
    expect(normalizeAssignmentStatus(legacy)).toBe(expected)
  })

  it.each([
    ["ai-plagiarism-check", "plagiarism-check"],
    ["review", "final-review"],
    ["done", "final-review"],
    ["unexpected", "ai-draft"],
  ] as const)("normalizes legacy progress stage %s", (legacy, expected) => {
    expect(normalizeAssignmentProgressStage(legacy)).toBe(expected)
  })

  it("forces terminal status percentages", () => {
    expect(getAssignmentProgress("not-started", "final-review")).toBe(0)
    expect(getAssignmentProgress("completed", "ai-draft")).toBe(100)
  })

  it.each(assignmentProgressStages)(
    "keeps $value label and percentage stable",
    ({ value, label, progress }) => {
      expect(getAssignmentProgressLabel(value)).toBe(label)
      expect(getAssignmentProgress("ongoing", value)).toBe(progress)
    },
  )
})
