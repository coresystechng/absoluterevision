import fs from "node:fs"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { neon } from "@neondatabase/serverless"
import { loadEnv } from "vite"

// Run locally. Secrets are saved only under Git metadata and never logged.
const env = loadEnv("development", process.cwd(), "")
const source = new URL(env.NEON_DATABASE_URL || env.VITE_NEON_DATABASE_URL)
const sql = neon(source.toString())
const role = "absolute_revision_browser"
const tables = ["users", "teams", "team_memberships", "assignments", "assignment_activities", "assignment_storage_folders", "assignment_files"]
const output = path.resolve(".git/client-submissions-browser.env")
if (fs.existsSync(output)) throw new Error("Credential file already exists; do not recreate the role.")
try {
  if ((await sql.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).length) throw new Error("Role already exists; inspect its configuration before proceeding.")
  const sequences = await sql.query("SELECT pg_get_serial_sequence('public.' || name, 'id') AS name FROM unnest($1::text[]) AS name", [tables])
  const quote = (name) => '"' + name.replaceAll('"', '""') + '"'
  const password = randomBytes(32).toString("hex")
  const statements = [
    sql.query(`CREATE ROLE ${quote(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${password}'`),
    sql.query(`GRANT USAGE ON SCHEMA public TO ${quote(role)}`),
    sql.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables.map(quote).join(", ")} TO ${quote(role)}`),
    ...sequences.filter((row) => row.name).map((row) => sql.query(`GRANT USAGE, SELECT ON SEQUENCE ${row.name.split(".").map(quote).join(".")} TO ${quote(role)}`)),
  ]
  await sql.transaction(statements)
  const browserUrl = new URL(source)
  browserUrl.username = role
  browserUrl.password = password
  const browser = neon(browserUrl.toString())
  const [permissions] = await browser.query(`SELECT current_user AS role,
    pg_has_role(current_user, $1, 'MEMBER') AS inherits_server,
    has_table_privilege(current_user, 'dropbox_owner_connections', 'SELECT') AS reads_dropbox,
    has_schema_privilege(current_user, 'public', 'CREATE') AS creates_schema_objects`, [decodeURIComponent(source.username)])
  if (permissions.inherits_server || permissions.reads_dropbox || permissions.creates_schema_objects) throw new Error("Role privacy verification failed; do not deploy these credentials.")
  for (const table of tables) await browser.query(`SELECT id FROM ${quote(table)} LIMIT 0`)
  fs.writeFileSync(output, `VITE_NEON_BROWSER_URL=${browserUrl.toString()}\n`, { mode: 0o600 })
  console.log("Restricted browser role verified. Credentials saved to .git/client-submissions-browser.env; do not commit or paste them into chat.")
} catch (error) {
  console.error(`Role setup stopped (${error.code || error.name}). No credentials were printed. Inspect database privileges before retrying.`)
  process.exitCode = 1
}
