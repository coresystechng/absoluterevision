import { initFilesDb, query } from "./db.js"
import {
  getWorkflowStage,
  isAssignmentType,
  normalizeWorkflowStage,
  type AssignmentProgressStage,
  type AssignmentType,
} from "../../shared/assignment-workflows.js"

export type PublicAssignmentStatus = {
  reference: string
  category: AssignmentType | null
  status: "not-started" | "ongoing" | "completed"
  progressStage: AssignmentProgressStage
  progress: number
  dueDate: string | null
}

type PublicAssignmentRow = {
  tracking_code: string
  category: string | null
  status: string
  progress_stage: string | null
  due_date: Date | string | null
}

const trackingCodePattern = /^AR-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/
const trackingReferencePattern = /^AR-[0-9A-F]{6}$/
const trackingAccessCodePattern = /^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/

export function normalizeTrackingCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? ""
  return trackingCodePattern.test(normalized) ? normalized : null
}

export function normalizeTrackingCredentials(reference: string | null | undefined, accessCode: string | null | undefined) {
  const normalizedReference = reference?.trim().toUpperCase() ?? ""
  const normalizedAccessCode = accessCode?.trim().toUpperCase() ?? ""
  if (!trackingReferencePattern.test(normalizedReference) || !trackingAccessCodePattern.test(normalizedAccessCode)) {
    return null
  }
  const trackingCode = `AR-${normalizedAccessCode}-${normalizedReference.slice(3)}`
  return trackingCodePattern.test(trackingCode) ? { reference: normalizedReference, trackingCode } : null
}

function normalizeStatus(value: string): PublicAssignmentStatus["status"] {
  return value === "ongoing" || value === "completed" || value === "not-started" ? value : "not-started"
}

function toDateOnly(value: Date | string | null) {
  if (!value) return null
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/)
    return match ? match[0] : null
  }
  return value.toISOString().slice(0, 10)
}

function mapRow(row: PublicAssignmentRow): PublicAssignmentStatus {
  const status = normalizeStatus(row.status)
  const category = isAssignmentType(row.category) ? row.category : null
  const workflowType = category ?? "Assignment"
  const progressStage = normalizeWorkflowStage(workflowType, row.progress_stage)
  return {
    reference: `AR-${row.tracking_code.slice(-6)}`,
    category,
    status,
    progressStage,
    progress: status === "completed"
      ? 100
      : status === "not-started"
        ? 0
        : getWorkflowStage(workflowType, progressStage).progress,
    dueDate: toDateOnly(row.due_date),
  }
}

export async function getPublicAssignmentStatus(reference: string | null | undefined, accessCode: string | null | undefined) {
  const credentials = normalizeTrackingCredentials(reference, accessCode)
  if (!credentials) return null

  await initFilesDb()
  const rows = await query<PublicAssignmentRow>(
    `SELECT tracking_code, category, status, progress_stage, due_date
     FROM assignments
     WHERE tracking_code = $1
     LIMIT 1`,
    [credentials.trackingCode],
  )
  return rows[0] ? mapRow(rows[0]) : null
}
