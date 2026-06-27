import type { AssignmentStatus } from "@/types"

export const assignmentStatuses: Array<{ value: AssignmentStatus; label: string }> = [
  { value: "not-started", label: "Not Started" },
  { value: "ai-draft", label: "AI Draft" },
  { value: "humaned", label: "Humaned" },
  { value: "grammar-check", label: "Grammar Check" },
  { value: "ai-plagiarism-check", label: "AI/Plagiarism Check" },
  { value: "text-format", label: "Text Format" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
]

const legacyStatusMap: Record<string, AssignmentStatus> = {
  "not-started": "not-started",
  "in-progress": "ai-draft",
  done: "completed",
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

export function getAssignmentProgress(status: AssignmentStatus) {
  const index = assignmentStatuses.findIndex((item) => item.value === status)
  if (index === -1) {
    return 13
  }

  return Math.min(100, (index + 1) * 13)
}
