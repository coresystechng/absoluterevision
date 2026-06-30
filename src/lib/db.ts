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
        progress_stage TEXT NOT NULL DEFAULT 'ai-draft',
        due_date DATE,
        due_time TIME,
        progress INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_time TIME")
    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS progress_stage TEXT NOT NULL DEFAULT 'ai-draft'")
    await query(`
      UPDATE assignments
      SET progress_stage = CASE status
        WHEN 'ai-draft' THEN 'ai-draft'
        WHEN 'humaned' THEN 'humaned'
        WHEN 'grammar-check' THEN 'grammar-check'
        WHEN 'ai-plagiarism-check' THEN 'plagiarism-check'
        WHEN 'plagiarism-check' THEN 'plagiarism-check'
        WHEN 'text-format' THEN 'text-format'
        WHEN 'review' THEN 'final-review'
        WHEN 'final-review' THEN 'final-review'
        WHEN 'completed' THEN 'final-review'
        WHEN 'done' THEN 'final-review'
        ELSE progress_stage
      END
      WHERE status IN (
        'ai-draft',
        'humaned',
        'grammar-check',
        'ai-plagiarism-check',
        'plagiarism-check',
        'text-format',
        'review',
        'final-review',
        'completed',
        'done'
      )
    `)
    await query(`
      UPDATE assignments
      SET status = CASE
        WHEN status IN ('completed', 'done') THEN 'completed'
        WHEN status = 'not-started' THEN 'not-started'
        ELSE 'ongoing'
      END
      WHERE status NOT IN ('not-started', 'ongoing', 'completed')
    `)
  })()

  return initPromise
}
