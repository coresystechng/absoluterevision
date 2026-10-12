import type { AssignmentType } from "./assignment-workflows.js"

export type SubmissionUploadAccess = { submissionId: string; token: string; fileIndex: number }
export type ClientSubmissionFile = {
  index: number
  name: string
  mimeType: string
  sizeBytes: number
  status: "pending" | "ready" | "failed"
}
export type ClientSubmission = {
  id: string
  fullName: string
  email: string
  submittedAt: string
  convertedAt: string | null
  assignmentId: number | null
  teamId: number | null
  files: ClientSubmissionFile[]
}
export type SubmissionTeam = {
  id: number
  name: string
  members: { userId: string; email: string; displayName: string | null }[]
}
export type ClientSubmissionsPage = {
  submissions: ClientSubmission[]
  teams: SubmissionTeam[]
  nextCursor: string | null
}
export type SubmissionAssignmentInput = {
  submissionId: string
  teamId: number
  assigneeUserId: string
  title: string
  category: AssignmentType
  priority: "low" | "medium" | "high"
  dueDate: string | null
  notes: string
}
