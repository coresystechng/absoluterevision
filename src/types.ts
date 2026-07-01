export type AssignmentPriority = "high" | "medium" | "low"
export type AssignmentType =
  | "Design"
  | "Copywriting"
  | "Dissertation"
  | "Assignment"
  | "Presentation"

export type AssignmentStatus =
  | "not-started"
  | "ongoing"
  | "completed"

export type AssignmentProgressStage =
  | "ai-draft"
  | "humaned"
  | "grammar-check"
  | "plagiarism-check"
  | "text-format"
  | "final-review"

export type Assignment = {
  id: number
  userId: string
  title: string
  category: AssignmentType | null
  priority: AssignmentPriority
  status: AssignmentStatus
  progressStage: AssignmentProgressStage
  dueDate: string | null
  dueTime: string | null
  progress: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type AssignmentInput = {
  title: string
  category?: AssignmentType | null
  priority?: AssignmentPriority
  status?: AssignmentStatus
  progressStage?: AssignmentProgressStage
  dueDate?: string | null
  dueTime?: string | null
  progress?: number
  notes?: string | null
}

export type UserProfile = {
  id: string
  email: string
  displayName: string | null
  createdAt: string
}

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
}

export type ThemePreference = "light" | "dark" | "system"
