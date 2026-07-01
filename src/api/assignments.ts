import { format, parseISO } from "date-fns"

import { initDb, query } from "@/lib/db"
import { toDateInputValue, toIsoDateTime, toTimeInputValue } from "@/lib/date-values"
import {
  getAssignmentProgress,
  getAssignmentProgressLabel,
  getAssignmentStatusLabel,
  normalizeAssignmentStatus,
  normalizeAssignmentProgressStage,
} from "@/lib/assignment-status"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import type {
  Assignment,
  AssignmentActivity,
  AssignmentActivityAction,
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

type AssignmentActivityRow = {
  id: number
  assignment_id: number
  user_id: string
  actor_name: string
  action: string
  message: string
  created_at: Date | string
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

function normalizeActivityAction(action: string): AssignmentActivityAction {
  return action === "created" ? "created" : "updated"
}

function mapActivity(row: AssignmentActivityRow): AssignmentActivity {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    actorName: row.actor_name,
    action: normalizeActivityAction(row.action),
    message: row.message,
    createdAt: toIsoDateTime(row.created_at),
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

function normalizeActorName(actorName?: string | null) {
  return actorName?.trim() || "Someone"
}

function priorityLabel(priority: AssignmentPriority) {
  if (priority === "high") {
    return "High"
  }
  if (priority === "medium") {
    return "Medium"
  }
  return "Low"
}

function quoted(value: string) {
  return `"${value}"`
}

function formatDeadline(assignment: Pick<Assignment, "dueDate" | "dueTime">) {
  if (!assignment.dueDate) {
    return "No deadline"
  }

  const due = parseISO(`${assignment.dueDate}T${assignment.dueTime ?? "00:00"}`)
  return assignment.dueTime
    ? format(due, "MMM d, yyyy h:mm a")
    : format(due, "MMM d, yyyy")
}

function buildActivityMessages(
  actorName: string | null | undefined,
  previous: Assignment,
  next: Assignment,
) {
  const actor = normalizeActorName(actorName)
  const messages: string[] = []

  if (previous.title !== next.title) {
    messages.push(
      `${actor} updated the title of the assignment from ${quoted(previous.title)} to ${quoted(next.title)}`,
    )
  }

  if (previous.category !== next.category) {
    messages.push(
      `${actor} updated the assignment type from ${previous.category ?? "Not set"} to ${next.category ?? "Not set"}`,
    )
  }

  if (previous.priority !== next.priority) {
    messages.push(
      `${actor} updated the priority of the assignment from ${priorityLabel(previous.priority)} to ${priorityLabel(next.priority)}`,
    )
  }

  if (previous.status !== next.status) {
    messages.push(
      `${actor} updated the status of the assignment from ${getAssignmentStatusLabel(previous.status)} to ${getAssignmentStatusLabel(next.status)}`,
    )
  }

  if (previous.progressStage !== next.progressStage) {
    messages.push(
      `${actor} updated the progress of the assignment from ${getAssignmentProgressLabel(previous.progressStage)} to ${getAssignmentProgressLabel(next.progressStage)}`,
    )
  }

  if (previous.dueDate !== next.dueDate || previous.dueTime !== next.dueTime) {
    messages.push(
      `${actor} updated the deadline of the assignment from ${formatDeadline(previous)} to ${formatDeadline(next)}`,
    )
  }

  if (previous.notes !== next.notes) {
    messages.push(`${actor} updated the assignment notes`)
  }

  return messages
}

async function addActivities(
  userId: string,
  assignmentId: number,
  actorName: string | null | undefined,
  messages: string[],
  action: AssignmentActivityAction = "updated",
) {
  for (const message of messages) {
    await query(
      `INSERT INTO assignment_activities
        (assignment_id, user_id, actor_name, action, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [assignmentId, userId, normalizeActorName(actorName), action, message],
    )
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

export async function getActivities(userId: string, assignmentId: number) {
  try {
    await initDb()
    const rows = await query<AssignmentActivityRow>(
      `SELECT *
       FROM assignment_activities
       WHERE user_id = $1 AND assignment_id = $2
       ORDER BY created_at ASC, id ASC`,
      [userId, assignmentId],
    )
    return rows.map(mapActivity)
  } catch (error) {
    console.error("Failed to fetch assignment activity", error)
    throw error
  }
}

export async function create(userId: string, input: AssignmentInput, actorName?: string | null) {
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
    const assignment = mapAssignment(rows[0])
    await addActivities(
      userId,
      assignment.id,
      actorName,
      [`${normalizeActorName(actorName)} created the assignment`],
      "created",
    )
    return assignment
  } catch (error) {
    console.error("Failed to create assignment", error)
    throw error
  }
}

export async function update(userId: string, id: number, input: AssignmentInput, actorName?: string | null) {
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

    const previous = mapAssignment(current)
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
    if (!row) {
      return null
    }

    const updated = mapAssignment(row)
    await addActivities(userId, id, actorName, buildActivityMessages(actorName, previous, updated))
    return updated
  } catch (error) {
    console.error("Failed to update assignment", error)
    throw error
  }
}

export async function updateStatus(
  userId: string,
  id: number,
  status: AssignmentStatus,
  actorName?: string | null,
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

    const previous = mapAssignment(current)
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
    if (!row) {
      return null
    }

    const updated = mapAssignment(row)
    await addActivities(userId, id, actorName, buildActivityMessages(actorName, previous, updated))
    return updated
  } catch (error) {
    console.error("Failed to update assignment status", error)
    throw error
  }
}

export async function updateProgressStage(
  userId: string,
  id: number,
  progressStage: AssignmentProgressStage,
  actorName?: string | null,
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

    const previous = mapAssignment(current)
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
    if (!row) {
      return null
    }

    const updated = mapAssignment(row)
    await addActivities(userId, id, actorName, buildActivityMessages(actorName, previous, updated))
    return updated
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
