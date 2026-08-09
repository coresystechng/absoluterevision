import { describe, expect, it } from "vitest"
import { getDeadlinePresentation, getPriorityPresentation, getProgressPresentation, getStatusPresentation, progressStagePresentation } from "@/lib/assignment-presentation"

describe("assignment presentation", () => {
  it("maps priorities and statuses to semantic tones", () => {
    expect(getPriorityPresentation("high")).toEqual({ label: "High", tone: "danger" })
    expect(getPriorityPresentation("medium").tone).toBe("warning")
    expect(getPriorityPresentation("low").tone).toBe("neutral")
    expect(getStatusPresentation("not-started").tone).toBe("neutral")
    expect(getStatusPresentation("ongoing").tone).toBe("warning")
    expect(getStatusPresentation("completed").tone).toBe("success")
  })

  it("retains all six progress percentages and terminal overrides", () => {
    expect(Object.values(progressStagePresentation).map(({ progress }) => progress)).toEqual([15, 30, 45, 60, 75, 90])
    expect(getProgressPresentation("not-started", "final-review").progress).toBe(0)
    expect(getProgressPresentation("completed", "ai-draft")).toMatchObject({ progress: 100, tone: "success" })
    expect(getProgressPresentation("ongoing", "ai-draft")).toMatchObject({ progress: 15, tone: "danger" })
  })

  it("classifies deadline urgency with completed and missing fallbacks", () => {
    const now = new Date("2026-08-08T12:00:00")
    expect(getDeadlinePresentation({ status: "completed", dueDate: "2020-01-01", now })).toMatchObject({ label: "Submitted", tone: "success" })
    expect(getDeadlinePresentation({ status: "ongoing", dueDate: null, now })).toMatchObject({ urgency: "none", tone: "neutral" })
    expect(getDeadlinePresentation({ status: "ongoing", dueDate: "2026-08-07", now }).urgency).toBe("overdue")
    expect(getDeadlinePresentation({ status: "ongoing", dueDate: "2026-08-10", now }).urgency).toBe("due-soon")
    expect(getDeadlinePresentation({ status: "ongoing", dueDate: "2026-08-20", now }).urgency).toBe("normal")
  })
})
