export type AssignmentPriority = "high" | "medium" | "low"
export type AssignmentStatus =
  | "not-started"
  | "ai-draft"
  | "humaned"
  | "grammar-check"
  | "ai-plagiarism-check"
  | "text-format"
  | "review"
  | "completed"

export type Assignment = {
  id: number
  userId: string
  title: string
  category: string | null
  priority: AssignmentPriority
  status: AssignmentStatus
  dueDate: string | null
  dueTime: string | null
  progress: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type AssignmentInput = {
  title: string
  category?: string | null
  priority?: AssignmentPriority
  status?: AssignmentStatus
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
