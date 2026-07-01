import type { AssignmentType } from "@/types"

export const defaultAssignmentType: AssignmentType = "Assignment"

export const assignmentTypes: Array<{ value: AssignmentType; label: AssignmentType }> = [
  { value: "Design", label: "Design" },
  { value: "Copywriting", label: "Copywriting" },
  { value: "Dissertation", label: "Dissertation" },
  { value: "Assignment", label: "Assignment" },
  { value: "Presentation", label: "Presentation" },
]

const assignmentTypeValues = new Set<AssignmentType>(
  assignmentTypes.map((type) => type.value),
)

const legacyAssignmentTypes = new Map<string, AssignmentType>([
  ["design", "Design"],
  ["copywriting", "Copywriting"],
  ["writing", "Copywriting"],
  ["copy writing", "Copywriting"],
  ["copy-writing", "Copywriting"],
  ["dissertation", "Dissertation"],
  ["assignment", "Assignment"],
  ["math", "Assignment"],
  ["maths", "Assignment"],
  ["mathematics", "Assignment"],
  ["science", "Assignment"],
  ["presentation", "Presentation"],
])

export function isAssignmentType(value: string | null | undefined): value is AssignmentType {
  return assignmentTypeValues.has(value as AssignmentType)
}

export function normalizeAssignmentType(value: string | null | undefined): AssignmentType {
  const trimmed = value?.trim()
  if (isAssignmentType(trimmed)) {
    return trimmed
  }

  return legacyAssignmentTypes.get(trimmed?.toLowerCase() ?? "") ?? defaultAssignmentType
}
