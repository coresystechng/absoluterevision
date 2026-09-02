import { assignmentTypeValues, isAssignmentType, type AssignmentType } from "../../shared/assignment-workflows"

export const defaultAssignmentType: AssignmentType = "Assignment"

export const assignmentTypes: Array<{ value: AssignmentType; label: AssignmentType }> = assignmentTypeValues.map((value) => ({ value, label: value }))

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

export function normalizeAssignmentType(value: string | null | undefined): AssignmentType {
  const trimmed = value?.trim()
  if (isAssignmentType(trimmed)) {
    return trimmed
  }

  return legacyAssignmentTypes.get(trimmed?.toLowerCase() ?? "") ?? defaultAssignmentType
}
