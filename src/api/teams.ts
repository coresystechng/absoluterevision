import { initDb, query } from "@/lib/db"
import { toIsoDateTime } from "@/lib/date-values"
import type { Team, TeamMember, TeamRole } from "@/types"

type TeamRow = {
  id: number
  name: string
  admin_user_id: string
  role: string
  member_count: string | number
  created_at: Date | string
  updated_at: Date | string
}

type TeamMemberRow = {
  id: number
  team_id: number
  user_id: string
  email: string
  display_name: string | null
  role: string
  created_at: Date | string
}

type UserRow = {
  id: string
}

function normalizeTeamRole(role: string): TeamRole {
  return role === "admin" ? "admin" : "member"
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    adminUserId: row.admin_user_id,
    role: normalizeTeamRole(row.role),
    memberCount: Number(row.member_count),
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }
}

function mapTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: normalizeTeamRole(row.role),
    createdAt: toIsoDateTime(row.created_at),
  }
}

async function requireTeamAdmin(userId: string, teamId: number) {
  const rows = await query<{ id: number }>(
    `SELECT tm.id
     FROM team_memberships tm
     WHERE tm.team_id = $1
       AND tm.user_id = $2
       AND tm.role = 'admin'
     LIMIT 1`,
    [teamId, userId],
  )

  if (!rows[0]) {
    throw new Error("Only team admins can manage team members.")
  }
}

export async function getTeams(userId: string) {
  await initDb()
  const rows = await query<TeamRow>(
    `SELECT
       t.*,
       tm.role,
       COUNT(members.id) AS member_count
     FROM teams t
     JOIN team_memberships tm
       ON tm.team_id = t.id
      AND tm.user_id = $1
     LEFT JOIN team_memberships members
       ON members.team_id = t.id
     GROUP BY t.id, tm.role
     ORDER BY
       CASE tm.role WHEN 'admin' THEN 1 ELSE 2 END,
       t.created_at ASC`,
    [userId],
  )

  return rows.map(mapTeam)
}

export async function getTeamMembers(userId: string, teamId: number) {
  await initDb()
  const access = await query<{ id: number }>(
    `SELECT id
     FROM team_memberships
     WHERE team_id = $1 AND user_id = $2
     LIMIT 1`,
    [teamId, userId],
  )
  if (!access[0]) {
    throw new Error("You do not have access to this team.")
  }

  const rows = await query<TeamMemberRow>(
    `SELECT
       tm.id,
       tm.team_id,
       tm.user_id,
       u.email,
       u.display_name,
       tm.role,
       tm.created_at
     FROM team_memberships tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY
       CASE tm.role WHEN 'admin' THEN 1 ELSE 2 END,
       COALESCE(NULLIF(u.display_name, ''), u.email) ASC`,
    [teamId],
  )

  return rows.map(mapTeamMember)
}

export async function createTeam(userId: string, name: string) {
  await initDb()
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error("Team name is required.")
  }

  const inserted = await query<{ id: number }>(
    `INSERT INTO teams (name, admin_user_id)
     VALUES ($1, $2)
     RETURNING id`,
    [normalizedName, userId],
  )
  const teamId = inserted[0].id
  await query(
    `INSERT INTO team_memberships (team_id, user_id, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (team_id, user_id) DO UPDATE
     SET role = 'admin'`,
    [teamId, userId],
  )

  const teams = await getTeams(userId)
  const team = teams.find((item) => item.id === teamId)
  if (!team) {
    throw new Error("Team could not be loaded.")
  }

  return team
}

export async function updateTeamName(userId: string, teamId: number, name: string) {
  await initDb()
  await requireTeamAdmin(userId, teamId)
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error("Team name is required.")
  }

  await query(
    `UPDATE teams
     SET name = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [teamId, normalizedName],
  )
}

export async function deleteTeam(userId: string, teamId: number) {
  await initDb()
  await requireTeamAdmin(userId, teamId)

  const remainingTeams = await query<{ team_id: number }>(
    `SELECT team_id
     FROM team_memberships
     WHERE user_id = $1
       AND team_id <> $2
     ORDER BY created_at ASC
     LIMIT 1`,
    [userId, teamId],
  )
  const nextTeamId = remainingTeams[0]?.team_id
  if (!nextTeamId) {
    throw new Error("Create another team before deleting your only workspace.")
  }

  await query(
    `UPDATE users
     SET active_team_id = NULL
     WHERE active_team_id = $1`,
    [teamId],
  )
  await query(
    `DELETE FROM teams
     WHERE id = $1
       AND admin_user_id = $2`,
    [teamId, userId],
  )
  await query(
    `UPDATE users
     SET active_team_id = $2
     WHERE id = $1`,
    [userId, nextTeamId],
  )

  return nextTeamId
}

export async function addTeamMember(userId: string, teamId: number, email: string) {
  await initDb()
  await requireTeamAdmin(userId, teamId)
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error("Member email is required.")
  }

  const users = await query<UserRow>(
    "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
    [normalizedEmail],
  )
  const member = users[0]
  if (!member) {
    throw new Error("That user needs to sign in once before they can be added to a team.")
  }

  await query(
    `INSERT INTO team_memberships (team_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (team_id, user_id) DO UPDATE
     SET role = CASE
       WHEN team_memberships.role = 'admin' THEN team_memberships.role
       ELSE 'member'
     END`,
    [teamId, member.id],
  )
}

export async function removeTeamMember(userId: string, teamId: number, memberUserId: string) {
  await initDb()
  await requireTeamAdmin(userId, teamId)
  if (memberUserId === userId) {
    throw new Error("You cannot remove yourself from a team you administer.")
  }

  await query(
    `UPDATE assignments
     SET assignee_user_id = $2,
         updated_at = NOW()
     WHERE team_id = $1
       AND assignee_user_id = $3`,
    [teamId, userId, memberUserId],
  )
  await query(
    `DELETE FROM team_memberships
     WHERE team_id = $1
       AND user_id = $2
       AND role <> 'admin'`,
    [teamId, memberUserId],
  )
}
