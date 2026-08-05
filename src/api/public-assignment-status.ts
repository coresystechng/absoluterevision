import type { AssignmentProgressStage, AssignmentStatus, AssignmentType } from "@/types"

export type PublicAssignmentStatus = {
  reference: string
  category: AssignmentType | null
  status: AssignmentStatus
  progressStage: AssignmentProgressStage
  progress: number
  dueDate: string | null
}

export class PublicAssignmentStatusError extends Error {
  constructor(public readonly kind: "not-found" | "rate-limited" | "unavailable") {
    super(kind)
  }
}

function isPublicAssignmentStatus(value: unknown): value is PublicAssignmentStatus {
  if (!value || typeof value !== "object") return false
  const assignment = value as Record<string, unknown>
  return typeof assignment.reference === "string" &&
    typeof assignment.status === "string" &&
    typeof assignment.progressStage === "string" &&
    typeof assignment.progress === "number" &&
    (typeof assignment.dueDate === "string" || assignment.dueDate === null)
}

export async function getPublicAssignmentStatus(reference: string, accessCode: string) {
  const response = await fetch("/api/assignment-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, accessCode }),
  })
  if (response.status === 404) throw new PublicAssignmentStatusError("not-found")
  if (response.status === 429) throw new PublicAssignmentStatusError("rate-limited")
  if (!response.ok) throw new PublicAssignmentStatusError("unavailable")

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object" || !isPublicAssignmentStatus((payload as { assignment?: unknown }).assignment)) {
    throw new PublicAssignmentStatusError("unavailable")
  }
  return (payload as { assignment: PublicAssignmentStatus }).assignment
}
