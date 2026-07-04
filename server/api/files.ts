export type AssignmentFileCategory =
  | "brief"
  | "lecture-notes"
  | "slides"
  | "guide"
  | "draft"
  | "final"
  | "other"

export const assignmentFileCategoryFolders: Record<AssignmentFileCategory, string> = {
  brief: "Briefs",
  "lecture-notes": "Lecture Notes",
  slides: "Slides",
  guide: "Guides",
  draft: "Drafts",
  final: "Final",
  other: "Other",
}

export function normalizeAssignmentFileCategory(
  category: unknown,
): AssignmentFileCategory {
  return typeof category === "string" && category in assignmentFileCategoryFolders
    ? (category as AssignmentFileCategory)
    : "other"
}

export function slugifyFolderSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
}

export function normalizeFileName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : ""
  const reservedCharacters = new Set(["<", ">", ":", "\"", "/", "\\", "|", "?", "*"])
  return Array.from(name)
    .map((character) =>
      reservedCharacters.has(character) || character.charCodeAt(0) < 32 ? "_" : character,
    )
    .join("")
    .slice(0, 180)
}

export function normalizeEncodedFileName(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  try {
    return normalizeFileName(decodeURIComponent(value))
  } catch {
    return normalizeFileName(value)
  }
}
