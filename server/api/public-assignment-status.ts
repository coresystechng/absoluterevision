import { initFilesDb, query } from "./db.js"

export type PublicAssignmentStatus = {
  trackingCode: string
  category: "Design" | "Copywriting" | "Dissertation" | "Assignment" | "Presentation" | null
  status: "not-started" | "ongoing" | "completed"
  progressStage: "ai-draft" | "humaned" | "grammar-check" | "plagiarism-check" | "text-format" | "final-review"
  progress: number
  dueDate: string | null
  updatedAt: string
}

type PublicAssignmentRow = {
  tracking_code: string
  category: string | null
  status: string
  progress_stage: string | null
  due_date: Date | string | null
  updated_at: Date | string
}

const trackingCodePattern = /^AR-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/
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

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapRow(row: PublicAssignmentRow): PublicAssignmentStatus {
  const status = normalizeStatus(row.status)
  const progressStage = normalizeStage(row.progress_stage)
  return {
    trackingCode: row.tracking_code,
    category: categories.has(row.category ?? "")
      ? row.category as PublicAssignmentStatus["category"]
      : null,
    status,
    progressStage,
    progress: status === "completed" ? 100 : status === "not-started" ? 0 : stageProgress[progressStage],
    dueDate: toDateOnly(row.due_date),
    updatedAt: toIso(row.updated_at),
  }
}

export async function getPublicAssignmentStatus(trackingId: string | null | undefined) {
  const trackingCode = normalizeTrackingCode(trackingId)
  if (!trackingCode) return null

  await initFilesDb()
  const rows = await query<PublicAssignmentRow>(
    `SELECT tracking_code, category, status, progress_stage, due_date, updated_at
     FROM assignments
     WHERE tracking_code = $1
     LIMIT 1`,
    [trackingCode],
  )
  return rows[0] ? mapRow(rows[0]) : null
}
