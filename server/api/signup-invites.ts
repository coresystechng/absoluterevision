import { createHash, randomBytes } from "node:crypto"

import { initFilesDb, query } from "./db.js"
import { HttpError } from "./http.js"

const invitePattern = /^INV-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeInvite(value: string) {
  const normalized = value.trim().toUpperCase()
  return invitePattern.test(normalized) ? normalized : null
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export async function reserveSignupInvite(token: string, email: string) {
  const normalizedToken = normalizeInvite(token)
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedToken || !normalizedEmail) return null

  const receipt = randomBytes(24).toString("base64url")
  await initFilesDb()
  const rows = await query<{ id: string | number }>(
    `UPDATE signup_invites
     SET reserved_for_email = $2,
         reservation_hash = $3,
         reserved_until = NOW() + INTERVAL '15 minutes'
     WHERE token_hash = $1
       AND redeemed_at IS NULL
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (invited_email IS NULL OR invited_email = $2)
       AND (reserved_until IS NULL OR reserved_until < NOW() OR reserved_for_email = $2)
     RETURNING id`,
    [hash(normalizedToken), normalizedEmail, hash(receipt)],
  )
  return rows[0] ? receipt : null
}

export async function redeemSignupInvite(token: string, email: string, receipt: string, user?: { id: string; email: string; name: string | null }) {
  const normalizedToken = normalizeInvite(token)
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedToken || !normalizedEmail || !receipt) return false
  if (user && user.email.trim().toLowerCase() !== normalizedEmail) return false

  await initFilesDb()
  const rows = await query<{ id: string | number }>(
    `WITH redeemed AS (UPDATE signup_invites
     SET redeemed_at = NOW(),
         redeemed_by_email = $2,
         reservation_hash = NULL,
         reserved_until = NULL
     WHERE token_hash = $1
       AND redeemed_at IS NULL
       AND reserved_for_email = $2
       AND reservation_hash = $3
       AND reserved_until > NOW()
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (invited_email IS NULL OR invited_email = $2)
       AND (team_id IS NULL OR $4::text IS NOT NULL)
     RETURNING id, team_id),
     profile AS (
       INSERT INTO users (id, email, display_name, active_team_id)
       SELECT $4, $2, $5, team_id FROM redeemed WHERE team_id IS NOT NULL
       ON CONFLICT (id) DO UPDATE SET active_team_id = EXCLUDED.active_team_id
       RETURNING id
     ), membership AS (
       INSERT INTO team_memberships (team_id, user_id, role)
       SELECT redeemed.team_id, profile.id, 'member' FROM redeemed CROSS JOIN profile
       WHERE redeemed.team_id IS NOT NULL
       ON CONFLICT (team_id, user_id) DO NOTHING
     ) SELECT id FROM redeemed`,
    [hash(normalizedToken), normalizedEmail, hash(receipt), user?.id ?? null, user?.name ?? null],
  )
  return Boolean(rows[0])
}

export async function requireInviteAdmin(userId: string, teamId: number) {
  if (!Number.isSafeInteger(teamId) || teamId <= 0) throw new HttpError(400, "Select a valid team.")
  await initFilesDb()
  const rows = await query<{ id: number }>("SELECT id FROM team_memberships WHERE user_id = $1 AND team_id = $2 AND role = 'admin'", [userId, teamId])
  if (!rows[0]) throw new HttpError(403, "Only this team's admins can manage invitations.")
}

export async function createTeamSignupInvite(userId: string, teamId: number, email: string) {
  await requireInviteAdmin(userId, teamId)
  const recipient = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254) throw new HttpError(400, "Enter a valid recipient email.")
  const value = randomBytes(9).toString("hex").toUpperCase()
  const token = `INV-${value.slice(0, 6)}-${value.slice(6, 12)}-${value.slice(12, 18)}`
  const rows = await query<{ id: string; expires_at: string }>(
    `INSERT INTO signup_invites (token_hash, team_id, created_by_user_id, invited_email, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days') RETURNING id, expires_at`,
    [hash(token), teamId, userId, recipient],
  )
  return { token, email: recipient, expiresAt: rows[0].expires_at }
}

export async function listTeamSignupInvites(userId: string, teamId: number) {
  await requireInviteAdmin(userId, teamId)
  return query<{ id: string; email: string; expiresAt: string; status: string }>(
    `SELECT id::text, invited_email AS email, expires_at AS "expiresAt",
       CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN redeemed_at IS NOT NULL THEN 'used'
         WHEN expires_at <= NOW() THEN 'expired' ELSE 'pending' END AS status
     FROM signup_invites WHERE team_id = $1 ORDER BY created_at DESC LIMIT 100`, [teamId],
  )
}

export async function revokeTeamSignupInvite(userId: string, teamId: number, inviteId: string) {
  await requireInviteAdmin(userId, teamId)
  if (!/^\d+$/.test(inviteId)) throw new HttpError(400, "Invalid invitation.")
  await query("UPDATE signup_invites SET revoked_at = NOW() WHERE id = $1 AND team_id = $2 AND redeemed_at IS NULL AND revoked_at IS NULL", [inviteId, teamId])
}

export async function releaseSignupInvite(token: string, email: string, receipt: string) {
  const normalizedToken = normalizeInvite(token)
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedToken || !normalizedEmail || !receipt) return

  await initFilesDb()
  await query(
    `UPDATE signup_invites
     SET reserved_for_email = NULL,
         reservation_hash = NULL,
         reserved_until = NULL
     WHERE token_hash = $1
       AND redeemed_at IS NULL
       AND reserved_for_email = $2
       AND reservation_hash = $3`,
    [hash(normalizedToken), normalizedEmail, hash(receipt)],
  )
}
