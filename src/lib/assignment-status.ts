import type { AssignmentProgressStage, AssignmentStatus } from "@/types"

export const assignmentStatuses: Array<{ value: AssignmentStatus; label: string }> = [
  { value: "not-started", label: "Not Started" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
]

export const assignmentProgressStages: Array<{
  value: AssignmentProgressStage
  label: string
  progress: number
  indicatorClassName: string
}> = [
  { value: "ai-draft", label: "AI Draft", progress: 15, indicatorClassName: "bg-red-500" },
  { value: "humaned", label: "Humaned", progress: 30, indicatorClassName: "bg-orange-500" },
  { value: "grammar-check", label: "Grammar Check", progress: 45, indicatorClassName: "bg-amber-500" },
  { value: "plagiarism-check", label: "Plagiarism Check", progress: 60, indicatorClassName: "bg-yellow-500" },
  { value: "text-format", label: "Text Format", progress: 75, indicatorClassName: "bg-lime-500" },
  { value: "final-review", label: "Final Review", progress: 90, indicatorClassName: "bg-emerald-500" },
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
  if (status === "not-started") {
    return "bg-slate-400 dark:bg-slate-500"
  }

  if (status === "completed") {
    return "bg-green-600 dark:bg-green-500"
  }

  return (
    assignmentProgressStages.find((item) => item.value === progressStage)?.indicatorClassName ??
    "bg-red-500"
  )
}

export function getAssignmentProgress(
  status: AssignmentStatus,
  progressStage: AssignmentProgressStage,
) {
  if (status === "not-started") {
    return 0
  }

  if (status === "completed") {
    return 100
  }

  return (
    assignmentProgressStages.find((item) => item.value === progressStage)?.progress ??
    15
  )
}
