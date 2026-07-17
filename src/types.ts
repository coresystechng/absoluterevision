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

export type AssignmentActivityAction = "created" | "updated"

export type TeamRole = "admin" | "member"

export type AssignmentFileCategory =
  | "brief"
  | "lecture-notes"
  | "slides"
  | "guide"
  | "draft"
  | "final"
  | "other"

export type AssignmentFileStatus = "uploading" | "ready" | "failed" | "deleted"

export type Assignment = {
  id: number
  userId: string
  teamId: number
  teamName: string
  currentUserRole: TeamRole
  assigneeUserId: string
  assigneeName: string | null
  assigneeEmail: string | null
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
  teamId?: number
  assigneeUserId?: string
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

export type AssignmentActivity = {
  id: number
  assignmentId: number
  userId: string
  actorName: string
  action: AssignmentActivityAction
  message: string
  createdAt: string
}

export type AssignmentFile = {
  id: number
  assignmentId: number
  userId: string
  provider: "dropbox"
  providerFileId: string
  providerFolderId: string | null
  name: string
  mimeType: string
  sizeBytes: number
  category: AssignmentFileCategory
  webViewLink: string | null
  webContentLink: string | null
  status: AssignmentFileStatus
  createdAt: string
  updatedAt: string
}

export type AssignmentFileUpload = {
  file: File
  category: AssignmentFileCategory
}

export type UserProfile = {
  id: string
  email: string
  displayName: string | null
  activeTeamId: number | null
  dashboardFilters: DashboardFilterPreferences
  createdAt: string
}

export type DashboardFilterPreferences = {
  type: AssignmentType | "all"
  priority: AssignmentPriority | "all"
  status: AssignmentStatus | "all"
}

export type Team = {
  id: number
  name: string
  adminUserId: string
  role: TeamRole
  memberCount: number
  createdAt: string
  updatedAt: string
}

export type TeamMember = {
  id: number
  teamId: number
  userId: string
  email: string
  displayName: string | null
  role: TeamRole
  createdAt: string
}

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
}

export type ThemePreference = "light" | "dark" | "system"
