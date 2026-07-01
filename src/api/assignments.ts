import { initDb, query } from "@/lib/db"
import { toDateInputValue, toIsoDateTime, toTimeInputValue } from "@/lib/date-values"
import {
  getAssignmentProgress,
  normalizeAssignmentStatus,
  normalizeAssignmentProgressStage,
} from "@/lib/assignment-status"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import type {
  Assignment,
  AssignmentInput,
  AssignmentProgressStage,
  AssignmentPriority,
  AssignmentStatus,
} from "@/types"

type AssignmentRow = {
  id: number
  user_id: string
  title: string
  category: string | null
  priority: AssignmentPriority
  status: string
  progress_stage: string | null
  due_date: Date | string | null
  due_time: Date | string | null
  progress: number
  notes: string | null
  created_at: Date | string
  updated_at: Date | string
}

function mapAssignment(row: AssignmentRow): Assignment {
  const status = normalizeAssignmentStatus(row.status)
  const progressStage = normalizeAssignmentProgressStage(row.progress_stage ?? row.status)

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: normalizeAssignmentType(row.category),
    priority: row.priority,
    status,
    progressStage,
    dueDate: toDateInputValue(row.due_date),
    dueTime: toTimeInputValue(row.due_time),
    progress: getAssignmentProgress(status, progressStage),
    notes: row.notes,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }
}

function normalizeInput(input: AssignmentInput): Required<AssignmentInput> {
  const status = normalizeAssignmentStatus(input.status ?? "not-started")
  const progressStage = normalizeInputProgressStage(status, input.progressStage)
  const progress = getAssignmentProgress(status, progressStage)

  return {
    title: input.title.trim(),
    category: normalizeAssignmentType(input.category),
    priority: input.priority ?? "medium",
    status,
    progressStage,
    dueDate: input.dueDate || null,
    dueTime: input.dueTime || null,
    progress,
    notes: input.notes?.trim() || null,
  }
}

function normalizeInputProgressStage(
  status: AssignmentStatus,
  progressStage?: AssignmentProgressStage,
) {
  if (status === "not-started") {
    return "ai-draft"
  }

  if (status === "completed") {
    return "final-review"
  }

  return normalizeAssignmentProgressStage(progressStage)
}

export async function getAll(userId: string) {
  try {
    await initDb()
    const rows = await query<AssignmentRow>(
      `SELECT * FROM assignments
       WHERE user_id = $1
       ORDER BY
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         due_date ASC NULLS LAST,
         created_at DESC`,
      [userId],
    )
    return rows.map(mapAssignment)
  } catch (error) {
    console.error("Failed to fetch assignments", error)
    throw error
  }
}

export async function getById(userId: string, id: number) {
  try {
    await initDb()
    const rows = await query<AssignmentRow>(
      "SELECT * FROM assignments WHERE user_id = $1 AND id = $2 LIMIT 1",
      [userId, id],
    )
    const [assignment] = rows.map(mapAssignment)
    return assignment ?? null
  } catch (error) {
    console.error("Failed to fetch assignment", error)
    throw error
  }
}

export async function create(userId: string, input: AssignmentInput) {
  try {
    await initDb()
    const data = normalizeInput(input)
    const rows = await query<AssignmentRow>(
      `INSERT INTO assignments
        (user_id, title, category, priority, status, progress_stage, due_date, due_time, progress, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        data.title,
        data.category,
        data.priority,
        data.status,
        data.progressStage,
        data.dueDate,
        data.dueTime,
        data.progress,
        data.notes,
      ],
    )
    return mapAssignment(rows[0])
  } catch (error) {
    console.error("Failed to create assignment", error)
    throw error
  }
}

export async function update(userId: string, id: number, input: AssignmentInput) {
  try {
    await initDb()
    const data = normalizeInput(input)
    const rows = await query<AssignmentRow>(
      `UPDATE assignments
       SET title = $3,
           category = $4,
           priority = $5,
           status = $6,
           progress_stage = $7,
           due_date = $8,
           due_time = $9,
           progress = $10,
           notes = $11,
           updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [
        userId,
        id,
        data.title,
        data.category,
        data.priority,
        data.status,
        data.progressStage,
        data.dueDate,
        data.dueTime,
        data.progress,
        data.notes,
      ],
    )
    const row = rows[0]
    return row ? mapAssignment(row) : null
  } catch (error) {
    console.error("Failed to update assignment", error)
    throw error
  }
}

export async function updateStatus(
  userId: string,
  id: number,
  status: AssignmentStatus,
) {
  try {
    await initDb()
    const currentRows = await query<AssignmentRow>(
      "SELECT * FROM assignments WHERE user_id = $1 AND id = $2 LIMIT 1",
      [userId, id],
    )
    const [current] = currentRows
    if (!current) {
      return null
    }

    const nextStatus = normalizeAssignmentStatus(status)
    const progressStage = normalizeInputProgressStage(
      nextStatus,
      normalizeAssignmentProgressStage(current.progress_stage ?? current.status),
    )
    const progress = getAssignmentProgress(nextStatus, progressStage)
    const rows = await query<AssignmentRow>(
      `UPDATE assignments
       SET status = $3,
           progress_stage = $4,
           progress = $5,
           updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, id, nextStatus, progressStage, progress],
    )
    const row = rows[0]
    return row ? mapAssignment(row) : null
  } catch (error) {
    console.error("Failed to update assignment status", error)
    throw error
  }
}

export async function updateProgressStage(
  userId: string,
  id: number,
  progressStage: AssignmentProgressStage,
) {
  try {
    await initDb()
    const nextProgressStage = normalizeAssignmentProgressStage(progressStage)
    const status: AssignmentStatus = "ongoing"
    const progress = getAssignmentProgress(status, nextProgressStage)
    const rows = await query<AssignmentRow>(
      `UPDATE assignments
       SET status = $3,
           progress_stage = $4,
           progress = $5,
           updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, id, status, nextProgressStage, progress],
    )
    const row = rows[0]
    return row ? mapAssignment(row) : null
  } catch (error) {
    console.error("Failed to update assignment progress stage", error)
    throw error
  }
}

export async function remove(userId: string, id: number) {
  try {
    await initDb()
    await query("DELETE FROM assignments WHERE user_id = $1 AND id = $2", [
      userId,
      id,
    ])
  } catch (error) {
    console.error("Failed to delete assignment", error)
    throw error
  }
}

export async function removeAll(userId: string) {
  try {
    await initDb()
    await query("DELETE FROM assignments WHERE user_id = $1", [userId])
  } catch (error) {
    console.error("Failed to delete assignments", error)
    throw error
  }
}
