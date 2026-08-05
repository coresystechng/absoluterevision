import type { PublicAssignmentStatus } from "@/api/public-assignment-status"
import type { AssignmentProgressStage, AssignmentStatus } from "@/types"

export const trackingCodePattern = /^AR-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/
export const trackingReferencePattern = /^AR-[0-9A-F]{6}$/
export const trackingAccessCodePattern = /^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/

export function normalizeTrackingCode(value: string) {
  const normalized = value.trim().toUpperCase()
  return trackingCodePattern.test(normalized) ? normalized : null
}

export function normalizeTrackingReference(value: string) {
  const normalized = value.trim().toUpperCase()
  return trackingReferencePattern.test(normalized) ? normalized : null
}

export function normalizeTrackingAccessCode(value: string) {
  const normalized = value.trim().toUpperCase()
  return trackingAccessCodePattern.test(normalized) ? normalized : null
}

export function splitTrackingCode(value: string) {
  const trackingCode = normalizeTrackingCode(value)
  if (!trackingCode) return null
  const [, first, second, third, last] = trackingCode.split("-")
  return {
    reference: `AR-${last}`,
    accessCode: `${first}-${second}-${third}`,
  }
}

export function getPublicStatusLabel(status: AssignmentStatus) {
  if (status === "completed") return "Completed"
  if (status === "ongoing") return "In progress"
  return "Received"
}

const stageDetails: Record<AssignmentProgressStage, { label: string; description: string; progress: number }> = {
  "ai-draft": { label: "Initial draft", description: "Your work has been received and is being prepared.", progress: 15 },
  humaned: { label: "Expert editing", description: "An editor is reviewing your manuscript.", progress: 30 },
  "grammar-check": { label: "Grammar check", description: "Grammar, language, and clarity are being checked.", progress: 45 },
  "plagiarism-check": { label: "Plagiarism check", description: "Plagiarism and originality checks are in progress.", progress: 60 },
  "text-format": { label: "Formatting", description: "Formatting is being refined.", progress: 75 },
  "final-review": { label: "Final quality check", description: "A final quality check is underway.", progress: 90 },
}

export const publicProgressStages = Object.entries(stageDetails).map(([value, details]) => ({
  value: value as AssignmentProgressStage,
  ...details,
}))

export function getPublicStageDetails(stage: AssignmentProgressStage) {
  return stageDetails[stage]
}

export function getPublicProgress(status: AssignmentStatus, stage: AssignmentProgressStage) {
  if (status === "not-started") return 0
  if (status === "completed") return 100
  return stageDetails[stage].progress
}

export function getPublicMilestones(assignment: Pick<PublicAssignmentStatus, "status" | "progressStage">) {
  const currentIndex = publicProgressStages.findIndex((stage) => stage.value === assignment.progressStage)
  return publicProgressStages.map((stage, index) => ({
    ...stage,
    state: assignment.status === "completed"
      ? "complete"
      : assignment.status === "not-started"
        ? "upcoming"
        : index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
  }))
}

export function formatPublicDueDate(value: string | null) {
  if (!value) return "No due date available"
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return "No due date available"
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`))
}
