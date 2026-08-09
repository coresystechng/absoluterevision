import type { AssignmentProgressStage, AssignmentStatus } from "@/types"
import { getProgressPresentation, progressStagePresentation, semanticTextClassNames, statusPresentation, type SemanticTone } from "@/lib/assignment-presentation"

const progressIndicatorClassNames: Record<SemanticTone, string> = {
  success: "bg-success-foreground",
  warning: "bg-warning-foreground",
  danger: "bg-danger-foreground",
  info: "bg-info-foreground",
  neutral: "bg-neutral-foreground",
}

export const assignmentStatuses = (Object.entries(statusPresentation) as Array<[AssignmentStatus, { label: string }]>).map(([value, item]) => ({ value, label: item.label }))

export const assignmentProgressStages: Array<{
  value: AssignmentProgressStage
  label: string
  progress: number
  tone: "success" | "warning" | "danger" | "info" | "neutral"
}> = [
  ...Object.entries(progressStagePresentation).map(([value, item]) => ({ value: value as AssignmentProgressStage, ...item })),
]

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

const legacyProgressStageMap: Record<string, AssignmentProgressStage> = {
  "not-started": "ai-draft",
  "in-progress": "ai-draft",
  "ai-draft": "ai-draft",
  humaned: "humaned",
  "grammar-check": "grammar-check",
  "ai-plagiarism-check": "plagiarism-check",
  "plagiarism-check": "plagiarism-check",
  "text-format": "text-format",
  review: "final-review",
  "final-review": "final-review",
  done: "final-review",
  completed: "final-review",
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
): AssignmentProgressStage {
  if (
    progressStage &&
    assignmentProgressStages.some((item) => item.value === progressStage)
  ) {
    return progressStage as AssignmentProgressStage
  }

  return progressStage ? legacyProgressStageMap[progressStage] ?? "ai-draft" : "ai-draft"
}

export function getAssignmentProgressLabel(progressStage: AssignmentProgressStage) {
  return (
    assignmentProgressStages.find((item) => item.value === progressStage)?.label ??
    "AI Draft"
  )
}

export function getAssignmentProgressIndicatorClassName(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
) {
  return progressIndicatorClassNames[getProgressPresentation(status, progressStage).tone]
}

export function getAssignmentProgressTextClassName(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
) {
  return semanticTextClassNames[getProgressPresentation(status, progressStage).tone]
}

export function getAssignmentProgress(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
) {
  return getProgressPresentation(status, progressStage).progress
}
