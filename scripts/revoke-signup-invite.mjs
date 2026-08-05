import { createHash } from "node:crypto"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.VITE_NEON_DATABASE_URL
if (!databaseUrl) throw new Error("Set NEON_DATABASE_URL before revoking an invitation.")

const token = process.argv[2]?.trim().toUpperCase()
if (!/^INV-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/.test(token ?? "")) {
  throw new Error("Pass the invitation to revoke: npm run invites:revoke -- INV-XXXXXX-XXXXXX-XXXXXX")
}

const sql = neon(databaseUrl)
const tokenHash = createHash("sha256").update(token).digest("hex")
const rows = await sql.query(
  "UPDATE signup_invites SET revoked_at = NOW() WHERE token_hash = $1 AND redeemed_at IS NULL AND revoked_at IS NULL RETURNING id",
  [tokenHash],
)

if (!rows[0]) throw new Error("Invitation was not found, already used, or already revoked.")
process.stdout.write("Invitation revoked.\n")
