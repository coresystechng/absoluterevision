import { getWorkflowStage, type WorkflowTone } from "@/lib/assignment-workflows"
import type { AssignmentPriority, AssignmentProgressStage, AssignmentStatus, AssignmentType } from "@/types"

export type SemanticTone = WorkflowTone

export const semanticTextClassNames: Record<SemanticTone, string> = {
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
  info: "text-info-foreground",
  neutral: "text-neutral-foreground",
}

export const priorityPresentation: Record<AssignmentPriority, { label: string; tone: SemanticTone }> = {
  high: { label: "High", tone: "danger" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
}

export const statusPresentation: Record<AssignmentStatus, { label: string; tone: SemanticTone }> = {
  "not-started": { label: "Not Started", tone: "neutral" },
  ongoing: { label: "Ongoing", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
}

export function getPriorityPresentation(priority: AssignmentPriority) {
  return priorityPresentation[priority]
}

export function getStatusPresentation(status: AssignmentStatus) {
  return statusPresentation[status]
}

export function getProgressPresentation(
  status: AssignmentStatus,
  stage: AssignmentProgressStage,
  assignmentType: AssignmentType,
) {
  const presentation = getWorkflowStage(assignmentType, stage)
  if (status === "not-started") return { ...presentation, progress: 0, tone: "neutral" as const }
  if (status === "completed") return { ...presentation, progress: 100, tone: "success" as const }
  return presentation
}

export function getDeadlinePresentation({ status, dueDate, dueTime, now = new Date() }: {
  status: AssignmentStatus
  dueDate: string | null
  dueTime?: string | null
  now?: Date
}) {
  if (status === "completed") return { urgency: "normal" as const, tone: "success" as const, label: "Submitted" }
  if (!dueDate) return { urgency: "none" as const, tone: "neutral" as const, label: "No deadline" }
  const due = new Date(`${dueDate}T${dueTime ?? "00:00"}`)
  const diffMinutes = Math.floor((due.getTime() - now.getTime()) / 60000)
  if (diffMinutes <= 0) return { urgency: "overdue" as const, tone: "danger" as const, label: "Overdue" }
  const days = Math.floor(diffMinutes / 1440)
  const hours = Math.floor((diffMinutes % 1440) / 60)
  const minutes = diffMinutes % 60
  const label = days > 0 ? `${days}d ${hours} hrs left` : hours > 0 ? `${hours} hrs ${minutes} mins left` : minutes > 0 ? `${minutes} mins left` : "Due soon"
  return { urgency: diffMinutes <= 4320 ? "due-soon" as const : "normal" as const, tone: diffMinutes <= 4320 ? "warning" as const : "neutral" as const, label }
}
