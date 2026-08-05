import { createHash, randomBytes } from "node:crypto"

import { initFilesDb, query } from "./db.js"

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
       AND (reserved_until IS NULL OR reserved_until < NOW() OR reserved_for_email = $2)
     RETURNING id`,
    [hash(normalizedToken), normalizedEmail, hash(receipt)],
  )
  return rows[0] ? receipt : null
}

export async function redeemSignupInvite(token: string, email: string, receipt: string) {
  const normalizedToken = normalizeInvite(token)
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedToken || !normalizedEmail || !receipt) return false

  await initFilesDb()
  const rows = await query<{ id: string | number }>(
    `UPDATE signup_invites
     SET redeemed_at = NOW(),
         redeemed_by_email = $2,
         reservation_hash = NULL,
         reserved_until = NULL
     WHERE token_hash = $1
       AND redeemed_at IS NULL
       AND reserved_for_email = $2
       AND reservation_hash = $3
       AND reserved_until > NOW()
     RETURNING id`,
    [hash(normalizedToken), normalizedEmail, hash(receipt)],
  )
  return Boolean(rows[0])
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
