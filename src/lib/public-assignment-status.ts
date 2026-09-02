import type { PublicAssignmentStatus } from "@/api/public-assignment-status"
import { getAssignmentWorkflow, getWorkflowStage } from "@/lib/assignment-workflows"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import type { AssignmentProgressStage, AssignmentStatus, AssignmentType } from "@/types"

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

export function getPublicProgressStages(assignmentType: AssignmentType) {
  return getAssignmentWorkflow(assignmentType).map((stage) => ({
    value: stage.value as AssignmentProgressStage,
    label: stage.publicLabel,
    description: stage.description,
    progress: stage.progress,
  }))
}

export function getPublicStageDetails(assignmentType: AssignmentType, stage: AssignmentProgressStage) {
  const details = getWorkflowStage(assignmentType, stage)
  return { label: details.publicLabel, description: details.description, progress: details.progress }
}

export function getPublicProgress(
  assignmentType: AssignmentType,
  status: AssignmentStatus,
  stage: AssignmentProgressStage,
) {
  if (status === "not-started") return 0
  if (status === "completed") return 100
  return getWorkflowStage(assignmentType, stage).progress
}

export function getPublicMilestones(assignment: Pick<PublicAssignmentStatus, "category" | "status" | "progressStage">) {
  const assignmentType = normalizeAssignmentType(assignment.category)
  const publicProgressStages = getPublicProgressStages(assignmentType)
  const currentStage = getWorkflowStage(assignmentType, assignment.progressStage)
  const currentIndex = publicProgressStages.findIndex((stage) => stage.value === currentStage.value)
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
