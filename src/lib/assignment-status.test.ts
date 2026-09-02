import { describe, expect, it } from "vitest"

import {
  getAssignmentProgress,
  getAssignmentProgressIndicatorClassName,
  getAssignmentProgressLabel,
  getAssignmentProgressTextClassName,
  getAssignmentProgressStages,
  normalizeAssignmentProgressStage,
  normalizeAssignmentStatus,
} from "@/lib/assignment-status"
import { mapWorkflowStageByPosition } from "@/lib/assignment-workflows"

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
    expect(normalizeAssignmentProgressStage(legacy, "Assignment")).toBe(expected)
  })

  it("maps legacy editorial stages to the same Design workflow position", () => {
    expect(normalizeAssignmentProgressStage("ai-draft", "Design")).toBe("concept")
    expect(normalizeAssignmentProgressStage("plagiarism-check", "Design")).toBe("feedback")
    expect(mapWorkflowStageByPosition("Assignment", "Design", "humaned")).toBe("drafts")
    expect(mapWorkflowStageByPosition("Design", "Assignment", "clean-up")).toBe("text-format")
  })

  it("forces terminal status percentages", () => {
    expect(getAssignmentProgress("not-started", "final-review", "Assignment")).toBe(0)
    expect(getAssignmentProgress("completed", "concept", "Design")).toBe(100)
  })

  it.each(getAssignmentProgressStages("Assignment"))(
    "keeps $value label and percentage stable",
    ({ value, label, progress }) => {
      expect(getAssignmentProgressLabel(value, "Assignment")).toBe(label)
      expect(getAssignmentProgress("ongoing", value, "Assignment")).toBe(progress)
    },
  )

  it("exposes the Design-specific stages", () => {
    expect(getAssignmentProgressStages("Design").map(({ label }) => label)).toEqual([
      "Concept", "Drafts", "Main Design", "Feedback", "Clean Up", "Final Review",
    ])
  })

  it("gives every active progress stage a static semantic indicator", () => {
    const indicatorColors = getAssignmentProgressStages("Assignment").map(({ value }) =>
      getAssignmentProgressIndicatorClassName("ongoing", value, "Assignment"),
    )

    expect(indicatorColors.every((className) => className.endsWith("-foreground"))).toBe(true)
  })

  it("uses status colors for assignments outside the active workflow", () => {
    expect(getAssignmentProgressIndicatorClassName("not-started", "final-review", "Assignment")).toContain("neutral")
    expect(getAssignmentProgressIndicatorClassName("completed", "concept", "Design")).toContain("success")
    expect(getAssignmentProgressTextClassName("not-started", "final-review", "Design")).toContain("neutral")
    expect(getAssignmentProgressTextClassName("completed", "ai-draft", "Assignment")).toContain("success")
  })

  it.each(getAssignmentProgressStages("Assignment"))(
    "uses the $label progress tone for active assignment text",
    ({ value, tone }) => {
      expect(getAssignmentProgressTextClassName("ongoing", value, "Assignment")).toContain(tone)
    },
  )
})
