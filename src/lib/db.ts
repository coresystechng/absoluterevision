import { neon } from "@neondatabase/serverless"

const databaseUrl = import.meta.env.VITE_NEON_DATABASE_URL

if (!databaseUrl) {
  console.warn("Missing VITE_NEON_DATABASE_URL. Database calls will fail until it is configured.")
}

const sqlClient = databaseUrl
  ? neon(databaseUrl, {
      disableWarningInBrowsers: true,
    })
  : null

function getSqlClient() {
  if (!sqlClient) {
    throw new Error("Missing VITE_NEON_DATABASE_URL")
  }
  return sqlClient
}

export async function query<T>(queryWithPlaceholders: string, params: readonly unknown[] = []) {
  const rows = await getSqlClient().query(queryWithPlaceholders, [...params])
  return rows as T[]
}

let initPromise: Promise<void> | null = null

export function initDb() {
  initPromise ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'not-started',
        due_date DATE,
        due_time TIME,
        progress INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_time TIME")
  })()

  return initPromise
}
