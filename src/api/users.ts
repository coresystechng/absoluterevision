import { addDays, formatISO } from "date-fns"

import { initDb, query } from "@/lib/db"
import { toIsoDateTime } from "@/lib/date-values"
import type { AuthUser, UserProfile } from "@/types"

type UserRow = {
  id: string
  email: string
  display_name: string | null
  created_at: Date | string
}

type TeamRow = {
  id: number
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: toIsoDateTime(row.created_at),
  }
}

function getDefaultTeamName(user: Pick<AuthUser, "email" | "displayName">) {
  return `${user.displayName?.trim() || user.email.split("@")[0] || "My"}'s Team`
}

async function getOrCreateDefaultTeam(user: AuthUser) {
  const existing = await query<TeamRow>(
    "SELECT id FROM teams WHERE admin_user_id = $1 ORDER BY id ASC LIMIT 1",
    [user.id],
  )
  if (existing[0]) {
    await query(
      `INSERT INTO team_memberships (team_id, user_id, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [existing[0].id, user.id],
    )
    return existing[0].id
  }

  const inserted = await query<TeamRow>(
    `INSERT INTO teams (name, admin_user_id)
     VALUES ($1, $2)
     RETURNING id`,
    [getDefaultTeamName(user), user.id],
  )
  const teamId = inserted[0].id
  await query(
    `INSERT INTO team_memberships (team_id, user_id, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamId, user.id],
  )
  return teamId
}

async function seedAssignments(userId: string, teamId: number) {
  const today = new Date()
  await query(
    `INSERT INTO assignments
      (user_id, team_id, assignee_user_id, title, category, priority, status, progress_stage, due_date, progress, notes)
     VALUES
      ($1, $2, $1, 'Outline research essay', 'Copywriting', 'high', 'ongoing', 'ai-draft', $3, 15, 'Draft thesis and source list before the next study session.'),
      ($1, $2, $1, 'Complete calculus problem set', 'Assignment', 'medium', 'not-started', 'ai-draft', $4, 0, 'Focus on integration by parts and applications.'),
      ($1, $2, $1, 'Review biology flashcards', 'Assignment', 'low', 'completed', 'final-review', $5, 100, 'Photosynthesis and cell respiration review complete.')`,
    [
      userId,
      teamId,
      formatISO(addDays(today, 2), { representation: "date" }),
      formatISO(addDays(today, 5), { representation: "date" }),
      formatISO(addDays(today, -1), { representation: "date" }),
    ],
  )
}

export async function getOrCreateUser(user: AuthUser) {
  try {
    await initDb()
    const inserted = await query<UserRow>(
      `INSERT INTO users (id, email, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [user.id, user.email, user.displayName],
    )

    if (inserted.length > 0) {
      const teamId = await getOrCreateDefaultTeam(user)
      await seedAssignments(user.id, teamId)
      return mapUser(inserted[0])
    }

    await getOrCreateDefaultTeam(user)
    const existing = await query<UserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [
      user.id,
    ])
    const [row] = existing
    return mapUser(row)
  } catch (error) {
    console.error("Failed to get or create user", error)
    throw error
  }
}

export async function updateProfile(userId: string, displayName: string | null) {
  try {
    await initDb()
    const rows = await query<UserRow>(
      `UPDATE users
       SET display_name = $2
       WHERE id = $1
       RETURNING *`,
      [userId, displayName?.trim() || null],
    )
    return mapUser(rows[0])
  } catch (error) {
    console.error("Failed to update profile", error)
    throw error
  }
}
