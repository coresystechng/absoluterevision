import type { AssignmentFileCategory } from "@/types"

export const assignmentFileCategories: Array<{
  value: AssignmentFileCategory
  label: string
  folderName: string
}> = [
  { value: "brief", label: "Brief", folderName: "Briefs" },
  { value: "lecture-notes", label: "Lecture Notes", folderName: "Lecture Notes" },
  { value: "slides", label: "Slides", folderName: "Slides" },
  { value: "guide", label: "Guide", folderName: "Guides" },
  { value: "draft", label: "Draft", folderName: "Drafts" },
  { value: "final", label: "Final", folderName: "Final" },
  { value: "other", label: "Other", folderName: "Other" },
]

export function normalizeAssignmentFileCategory(
  category: string | null | undefined,
): AssignmentFileCategory {
  return assignmentFileCategories.some((item) => item.value === category)
    ? (category as AssignmentFileCategory)
    : "other"
}

export function getAssignmentFileCategoryLabel(category: AssignmentFileCategory) {
  return assignmentFileCategories.find((item) => item.value === category)?.label ?? "Other"
}
