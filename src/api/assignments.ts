import { initDb, query } from "@/lib/db"
import { toDateInputValue, toIsoDateTime, toTimeInputValue } from "@/lib/date-values"
import {
  getAssignmentProgress,
  normalizeAssignmentStatus,
} from "@/lib/assignment-status"
import type {
  Assignment,
  AssignmentInput,
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
  due_date: Date | string | null
  due_time: Date | string | null
  progress: number
  notes: string | null
  created_at: Date | string
  updated_at: Date | string
}

function mapAssignment(row: AssignmentRow): Assignment {
  const status = normalizeAssignmentStatus(row.status)

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    status,
    dueDate: toDateInputValue(row.due_date),
    dueTime: toTimeInputValue(row.due_time),
    progress: getAssignmentProgress(status),
    notes: row.notes,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }
}

function normalizeInput(input: AssignmentInput): Required<AssignmentInput> {
  const status = input.status ?? "not-started"
  const progress = getAssignmentProgress(status)

  return {
    title: input.title.trim(),
    category: input.category?.trim() || null,
    priority: input.priority ?? "medium",
    status,
    dueDate: input.dueDate || null,
    dueTime: input.dueTime || null,
    progress,
    notes: input.notes?.trim() || null,
  }
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
        (user_id, title, category, priority, status, due_date, due_time, progress, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        data.title,
        data.category,
        data.priority,
        data.status,
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
           due_date = $7,
           due_time = $8,
           progress = $9,
           notes = $10,
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
    const progress = getAssignmentProgress(status)
    const rows = await query<AssignmentRow>(
      `UPDATE assignments
       SET status = $3,
           progress = $4,
           updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, id, status, progress],
    )
    const row = rows[0]
    return row ? mapAssignment(row) : null
  } catch (error) {
    console.error("Failed to update assignment status", error)
    throw error
  }
}

export async function updateProgress(userId: string, id: number, progress: number) {
  try {
    await initDb()
    const rows = await query<AssignmentRow>(
      `UPDATE assignments
       SET progress = $3,
           updated_at = NOW()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, id, Math.min(100, Math.max(0, Math.round(progress)))],
    )
    const row = rows[0]
    return row ? mapAssignment(row) : null
  } catch (error) {
    console.error("Failed to update assignment progress", error)
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
