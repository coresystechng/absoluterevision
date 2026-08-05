import type { AssignmentProgressStage, AssignmentStatus, AssignmentType } from "@/types"

export type PublicAssignmentStatus = {
  trackingCode: string
  category: AssignmentType | null
  status: AssignmentStatus
  progressStage: AssignmentProgressStage
  progress: number
  dueDate: string | null
  updatedAt: string
}

export class PublicAssignmentStatusError extends Error {
  constructor(public readonly kind: "not-found" | "rate-limited" | "unavailable") {
    super(kind)
  }
}

function isPublicAssignmentStatus(value: unknown): value is PublicAssignmentStatus {
  if (!value || typeof value !== "object") return false
  const assignment = value as Record<string, unknown>
  return typeof assignment.trackingCode === "string" &&
    typeof assignment.status === "string" &&
    typeof assignment.progressStage === "string" &&
    typeof assignment.progress === "number" &&
    (typeof assignment.dueDate === "string" || assignment.dueDate === null) &&
    typeof assignment.updatedAt === "string"
}

export async function getPublicAssignmentStatus(trackingId: string) {
  const query = new URLSearchParams({ trackingId })
  const response = await fetch(`/api/assignment-status?${query.toString()}`)
  if (response.status === 404) throw new PublicAssignmentStatusError("not-found")
  if (response.status === 429) throw new PublicAssignmentStatusError("rate-limited")
  if (!response.ok) throw new PublicAssignmentStatusError("unavailable")

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object" || !isPublicAssignmentStatus((payload as { assignment?: unknown }).assignment)) {
    throw new PublicAssignmentStatusError("unavailable")
  }
  return (payload as { assignment: PublicAssignmentStatus }).assignment
}
