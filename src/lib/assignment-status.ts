import type { AssignmentProgressStage, AssignmentStatus, AssignmentType } from "@/types"
import { getProgressPresentation, semanticTextClassNames, statusPresentation, type SemanticTone } from "@/lib/assignment-presentation"
import {
  getAssignmentWorkflow,
  normalizeWorkflowStage,
} from "@/lib/assignment-workflows"

const progressIndicatorClassNames: Record<SemanticTone, string> = {
  success: "bg-success-foreground",
  warning: "bg-warning-foreground",
  danger: "bg-danger-foreground",
  info: "bg-info-foreground",
  neutral: "bg-neutral-foreground",
}

export const assignmentStatuses = (Object.entries(statusPresentation) as Array<[AssignmentStatus, { label: string }]>).map(([value, item]) => ({ value, label: item.label }))

export function getAssignmentProgressStages(assignmentType: AssignmentType) {
  return getAssignmentWorkflow(assignmentType).map((stage) => ({
    ...stage,
    value: stage.value as AssignmentProgressStage,
  }))
}

const legacyStatusMap: Record<string, AssignmentStatus> = {
  "not-started": "not-started",
  "in-progress": "ongoing",
  "ai-draft": "ongoing",
  humaned: "ongoing",
  "grammar-check": "ongoing",
  "ai-plagiarism-check": "ongoing",
  "plagiarism-check": "ongoing",
  "text-format": "ongoing",
  review: "ongoing",
  "final-review": "ongoing",
  done: "completed",
  completed: "completed",
}

export function normalizeAssignmentStatus(status: string): AssignmentStatus {
  if (assignmentStatuses.some((item) => item.value === status)) {
    return status as AssignmentStatus
  }

  return legacyStatusMap[status] ?? "not-started"
}

export function getAssignmentStatusLabel(status: AssignmentStatus) {
  return assignmentStatuses.find((item) => item.value === status)?.label ?? "Not Started"
}

export function normalizeAssignmentProgressStage(
  progressStage: string | null | undefined,
  assignmentType: AssignmentType,
): AssignmentProgressStage {
  return normalizeWorkflowStage(assignmentType, progressStage)
}

export function getAssignmentProgressLabel(
  progressStage: AssignmentProgressStage,
  assignmentType: AssignmentType,
) {
  return getProgressPresentation("ongoing", progressStage, assignmentType).label
}

export function getAssignmentProgressIndicatorClassName(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
  assignmentType: AssignmentType,
) {
  return progressIndicatorClassNames[getProgressPresentation(status, progressStage, assignmentType).tone]
}

export function getAssignmentProgressTextClassName(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
  assignmentType: AssignmentType,
) {
  return semanticTextClassNames[getProgressPresentation(status, progressStage, assignmentType).tone]
}

export function getAssignmentProgress(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
  assignmentType: AssignmentType,
) {
  return getProgressPresentation(status, progressStage, assignmentType).progress
}
