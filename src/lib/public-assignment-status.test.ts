import { describe, expect, it } from "vitest"
import { formatPublicDueDate, getPublicMilestones, getPublicProgress, getPublicStageDetails, getPublicStatusLabel, normalizeTrackingAccessCode, normalizeTrackingCode, normalizeTrackingReference, publicProgressStages, splitTrackingCode } from "./public-assignment-status"

describe("public tracking helpers", () => {
  it("validates pasted codes and labels every public status", () => {
    expect(normalizeTrackingCode(" ar-7a91f2-88c4d0-1b6e35-902af8 ")).toBe("AR-7A91F2-88C4D0-1B6E35-902AF8")
    expect(normalizeTrackingCode("7")).toBeNull()
    expect(normalizeTrackingReference(" ar-902af8 ")).toBe("AR-902AF8")
    expect(normalizeTrackingAccessCode(" 7a91f2-88c4d0-1b6e35 ")).toBe("7A91F2-88C4D0-1B6E35")
    expect(splitTrackingCode("AR-7A91F2-88C4D0-1B6E35-902AF8")).toEqual({ reference: "AR-902AF8", accessCode: "7A91F2-88C4D0-1B6E35" })
    expect(getPublicStatusLabel("not-started")).toBe("Received")
    expect(getPublicStatusLabel("ongoing")).toBe("In progress")
    expect(getPublicStatusLabel("completed")).toBe("Completed")
  })

  it("exposes the six client-friendly stage labels", () => {
    expect(publicProgressStages.map((stage) => stage.label)).toEqual([
      "Initial draft", "Expert editing", "Grammar check", "Plagiarism check", "Formatting", "Final quality check",
    ])
    expect(getPublicStageDetails("final-review").progress).toBe(90)
  })

  it("derives milestone boundaries and calculated progress", () => {
    expect(getPublicMilestones({ status: "not-started", progressStage: "humaned" }).every((item) => item.state === "upcoming")).toBe(true)
    expect(getPublicMilestones({ status: "ongoing", progressStage: "ai-draft" })[0].state).toBe("current")
    expect(getPublicMilestones({ status: "ongoing", progressStage: "humaned" }).slice(0, 2).map((item) => item.state)).toEqual(["complete", "current"])
    expect(getPublicMilestones({ status: "completed", progressStage: "ai-draft" }).every((item) => item.state === "complete")).toBe(true)
    expect(getPublicProgress("not-started", "humaned")).toBe(0)
    expect(getPublicProgress("completed", "humaned")).toBe(100)
  })

  it("formats null due dates safely", () => {
    expect(formatPublicDueDate(null)).toBe("No due date available")
  })
})
