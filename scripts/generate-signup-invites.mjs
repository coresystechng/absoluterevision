import { createHash, randomBytes } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.VITE_NEON_DATABASE_URL
if (!databaseUrl) throw new Error("Set NEON_DATABASE_URL before generating invitations.")

const sql = neon(databaseUrl)
const count = 10
const expiryDays = Number.parseInt(process.env.SIGNUP_INVITE_EXPIRY_DAYS ?? "", 10)
const expiresAt = Number.isFinite(expiryDays) && expiryDays > 0
  ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
  : null
const codes = Array.from({ length: count }, () => {
  const value = randomBytes(9).toString("hex").toUpperCase()
  return `INV-${value.slice(0, 6)}-${value.slice(6, 12)}-${value.slice(12, 18)}`
})

await sql.query(`
  CREATE TABLE IF NOT EXISTS signup_invites (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    label TEXT,
    expires_at TIMESTAMPTZ,
    reserved_for_email TEXT,
    reservation_hash TEXT,
    reserved_until TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    redeemed_by_email TEXT,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

for (const [index, code] of codes.entries()) {
  const tokenHash = createHash("sha256").update(code).digest("hex")
  await sql.query(
    "INSERT INTO signup_invites (token_hash, label, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO NOTHING",
    [tokenHash, `Private signup ${index + 1}`, expiresAt],
  )
}

const outputDirectory = resolve("private")
const outputFile = resolve(outputDirectory, `signup-invite-codes-${new Date().toISOString().slice(0, 10)}.txt`)
await mkdir(outputDirectory, { recursive: true })
await writeFile(outputFile, `${codes.join("\n")}\n`, { encoding: "utf8", mode: 0o600 })
process.stdout.write(`Generated ${count} one-time signup invitations in ${outputFile}\n`)
