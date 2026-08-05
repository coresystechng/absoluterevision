import { initFilesDb, query } from "./db.js"

export type PublicAssignmentStatus = {
  reference: string
  category: "Design" | "Copywriting" | "Dissertation" | "Assignment" | "Presentation" | null
  status: "not-started" | "ongoing" | "completed"
  progressStage: "ai-draft" | "humaned" | "grammar-check" | "plagiarism-check" | "text-format" | "final-review"
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
const categories = new Set(["Design", "Copywriting", "Dissertation", "Assignment", "Presentation"])
const stages = new Set(["ai-draft", "humaned", "grammar-check", "plagiarism-check", "text-format", "final-review"])
const stageProgress: Record<PublicAssignmentStatus["progressStage"], number> = {
  "ai-draft": 15,
  humaned: 30,
  "grammar-check": 45,
  "plagiarism-check": 60,
  "text-format": 75,
  "final-review": 90,
}

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

function normalizeStage(value: string | null): PublicAssignmentStatus["progressStage"] {
  return stages.has(value ?? "")
    ? value as PublicAssignmentStatus["progressStage"]
    : "ai-draft"
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
  const progressStage = normalizeStage(row.progress_stage)
  return {
    reference: `AR-${row.tracking_code.slice(-6)}`,
    category: categories.has(row.category ?? "")
      ? row.category as PublicAssignmentStatus["category"]
      : null,
    status,
    progressStage,
    progress: status === "completed" ? 100 : status === "not-started" ? 0 : stageProgress[progressStage],
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
