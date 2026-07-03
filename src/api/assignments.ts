import { format, parseISO } from "date-fns"

import { initDb, query } from "@/lib/db"
import { toDateInputValue, toIsoDateTime, toTimeInputValue } from "@/lib/date-values"
import {
  getAssignmentProgress,
  getAssignmentProgressLabel,
  getAssignmentStatusLabel,
  normalizeAssignmentProgressStage,
  normalizeAssignmentStatus,
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
  TeamRole,
} from "@/types"

type AssignmentRow = {
  id: number
  user_id: string
  team_id: number
  team_name: string
  current_user_role: string
  assignee_user_id: string
  assignee_email: string | null
  assignee_display_name: string | null
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

type NormalizedAssignmentInput = {
  teamId: number | null
  assigneeUserId: string | null
  title: string
  category: Assignment["category"]
  priority: AssignmentPriority
  status: AssignmentStatus
  progressStage: AssignmentProgressStage
  dueDate: string | null
  dueTime: string | null
  progress: number
  notes: string | null
}

function normalizeTeamRole(role: string): TeamRole {
  return role === "admin" ? "admin" : "member"
}

function getDisplayName(displayName: string | null, email: string | null) {
  return displayName?.trim() || email || null
}

function mapAssignment(row: AssignmentRow): Assignment {
  const status = normalizeAssignmentStatus(row.status)
  const progressStage = normalizeAssignmentProgressStage(row.progress_stage ?? row.status)

  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    teamName: row.team_name,
    currentUserRole: normalizeTeamRole(row.current_user_role),
    assigneeUserId: row.assignee_user_id,
    assigneeName: getDisplayName(row.assignee_display_name, row.assignee_email),
    assigneeEmail: row.assignee_email,
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

function normalizeInput(input: AssignmentInput): NormalizedAssignmentInput {
  const status = normalizeAssignmentStatus(input.status ?? "not-started")
  const progressStage = normalizeInputProgressStage(status, input.progressStage)
  const progress = getAssignmentProgress(status, progressStage)

  return {
    teamId: Number.isInteger(input.teamId) ? input.teamId ?? null : null,
    assigneeUserId: input.assigneeUserId?.trim() || null,
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

function formatAssignee(assignment: Pick<Assignment, "assigneeName" | "assigneeEmail">) {
  return assignment.assigneeName || assignment.assigneeEmail || "Unassigned"
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

  if (previous.teamId !== next.teamId) {
    messages.push(
      `${actor} moved the assignment from ${previous.teamName} to ${next.teamName}`,
    )
  }

  if (previous.assigneeUserId !== next.assigneeUserId) {
    messages.push(
      `${actor} reassigned the assignment from ${formatAssignee(previous)} to ${formatAssignee(next)}`,
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

function assignmentSelect(whereClause: string) {
  return `
    SELECT
      a.*,
      t.name AS team_name,
      tm.role AS current_user_role,
      assignee.email AS assignee_email,
      assignee.display_name AS assignee_display_name
    FROM assignments a
    JOIN teams t ON t.id = a.team_id
    JOIN team_memberships tm
      ON tm.team_id = a.team_id
    LEFT JOIN users assignee
      ON assignee.id = a.assignee_user_id
    WHERE ${whereClause}
  `
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

async function getFirstAdminTeamId(userId: string) {
  const rows = await query<{ team_id: number }>(
    `SELECT team_id
     FROM team_memberships
     WHERE user_id = $1
       AND role = 'admin'
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId],
  )

  return rows[0]?.team_id ?? null
}

async function requireAdminTeam(userId: string, teamId: number) {
  const rows = await query<{ id: number }>(
    `SELECT id
     FROM team_memberships
     WHERE team_id = $1
       AND user_id = $2
       AND role = 'admin'
     LIMIT 1`,
    [teamId, userId],
  )

  if (!rows[0]) {
    throw new Error("Only team admins can manage assignments for this team.")
  }
}

async function requireTeamMember(teamId: number, memberUserId: string) {
  const rows = await query<{ id: number }>(
    `SELECT id
     FROM team_memberships
     WHERE team_id = $1
       AND user_id = $2
     LIMIT 1`,
    [teamId, memberUserId],
  )

  if (!rows[0]) {
    throw new Error("Assignments can only be assigned to members of the selected team.")
  }
}

async function getAccessibleAssignmentRow(userId: string, id: number) {
  const rows = await query<AssignmentRow>(
    `${assignmentSelect(`
      tm.user_id = $1
      AND a.id = $2
      AND (tm.role = 'admin' OR a.assignee_user_id = $1)
    `)}
     LIMIT 1`,
    [userId, id],
  )

  return rows[0] ?? null
}

async function getAdminAssignmentRow(userId: string, id: number) {
  const rows = await query<AssignmentRow>(
    `${assignmentSelect(`
      tm.user_id = $1
      AND tm.role = 'admin'
      AND a.id = $2
    `)}
     LIMIT 1`,
    [userId, id],
  )

  return rows[0] ?? null
}

export async function getAll(userId: string, teamId?: number | null) {
  try {
    await initDb()
    const rows = await query<AssignmentRow>(
      `${assignmentSelect(`
        tm.user_id = $1
        AND ($2::integer IS NULL OR a.team_id = $2::integer)
        AND (tm.role = 'admin' OR a.assignee_user_id = $1)
      `)}
       ORDER BY
         CASE a.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         a.due_date ASC NULLS LAST,
         a.created_at DESC`,
      [userId, teamId ?? null],
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
    const row = await getAccessibleAssignmentRow(userId, id)
    return row ? mapAssignment(row) : null
  } catch (error) {
    console.error("Failed to fetch assignment", error)
    throw error
  }
}

export async function getActivities(userId: string, assignmentId: number) {
  try {
    await initDb()
    const assignment = await getAccessibleAssignmentRow(userId, assignmentId)
    if (!assignment) {
      return []
    }

    const rows = await query<AssignmentActivityRow>(
      `SELECT *
       FROM assignment_activities
       WHERE assignment_id = $1
       ORDER BY created_at ASC, id ASC`,
      [assignmentId],
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
    const teamId = data.teamId ?? (await getFirstAdminTeamId(userId))
    if (!teamId) {
      throw new Error("Create a team before adding assignments.")
    }

    await requireAdminTeam(userId, teamId)
    const assigneeUserId = data.assigneeUserId ?? userId
    await requireTeamMember(teamId, assigneeUserId)

    const rows = await query<{ id: number }>(
      `INSERT INTO assignments
        (
          user_id,
          team_id,
          assignee_user_id,
          title,
          category,
          priority,
          status,
          progress_stage,
          due_date,
          due_time,
          progress,
          notes
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        userId,
        teamId,
        assigneeUserId,
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
    const assignment = await getById(userId, rows[0].id)
    if (!assignment) {
      throw new Error("Assignment could not be loaded.")
    }
    await addActivities(
      userId,
      assignment.id,
      actorName,
      [`${normalizeActorName(actorName)} created the assignment for ${formatAssignee(assignment)}`],
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
    const current = await getAdminAssignmentRow(userId, id)
    if (!current) {
      return null
    }

    const previous = mapAssignment(current)
    const data = normalizeInput(input)
    const teamId = data.teamId ?? current.team_id
    await requireAdminTeam(userId, teamId)
    const assigneeUserId = data.assigneeUserId ?? current.assignee_user_id
    await requireTeamMember(teamId, assigneeUserId)

    const rows = await query<{ id: number }>(
      `UPDATE assignments
       SET team_id = $3,
           assignee_user_id = $4,
           title = $5,
           category = $6,
           priority = $7,
           status = $8,
           progress_stage = $9,
           due_date = $10,
           due_time = $11,
           progress = $12,
           notes = $13,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [
        userId,
        id,
        teamId,
        assigneeUserId,
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
    if (!rows[0]) {
      return null
    }

    const updated = await getById(userId, id)
    if (!updated) {
      return null
    }
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
    const current = await getAccessibleAssignmentRow(userId, id)
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
    const rows = await query<{ id: number }>(
      `UPDATE assignments
       SET status = $3,
           progress_stage = $4,
           progress = $5,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [userId, id, nextStatus, progressStage, progress],
    )
    if (!rows[0]) {
      return null
    }

    const updated = await getById(userId, id)
    if (!updated) {
      return null
    }
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
    const current = await getAccessibleAssignmentRow(userId, id)
    if (!current) {
      return null
    }

    const previous = mapAssignment(current)
    const nextProgressStage = normalizeAssignmentProgressStage(progressStage)
    const status: AssignmentStatus = "ongoing"
    const progress = getAssignmentProgress(status, nextProgressStage)
    const rows = await query<{ id: number }>(
      `UPDATE assignments
       SET status = $3,
           progress_stage = $4,
           progress = $5,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [userId, id, status, nextProgressStage, progress],
    )
    if (!rows[0]) {
      return null
    }

    const updated = await getById(userId, id)
    if (!updated) {
      return null
    }
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
    const current = await getAdminAssignmentRow(userId, id)
    if (!current) {
      return
    }

    await query("DELETE FROM assignments WHERE id = $1", [id])
  } catch (error) {
    console.error("Failed to delete assignment", error)
    throw error
  }
}

export async function removeAll(userId: string, teamId?: number | null) {
  try {
    await initDb()
    if (teamId) {
      await requireAdminTeam(userId, teamId)
      await query("DELETE FROM assignments WHERE team_id = $1", [teamId])
      return
    }

    await query(
      `DELETE FROM assignments
       WHERE team_id IN (
         SELECT team_id
         FROM team_memberships
         WHERE user_id = $1
           AND role = 'admin'
       )`,
      [userId],
    )
  } catch (error) {
    console.error("Failed to delete assignments", error)
    throw error
  }
}
