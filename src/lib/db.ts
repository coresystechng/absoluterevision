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
        dashboard_filter_type TEXT NOT NULL DEFAULT 'all',
        dashboard_filter_priority TEXT NOT NULL DEFAULT 'all',
        dashboard_filter_status TEXT NOT NULL DEFAULT 'all',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS team_memberships (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (team_id, user_id)
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        assignee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
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

    await query(`
      CREATE TABLE IF NOT EXISTS assignment_activities (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_name TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'updated',
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS assignment_storage_folders (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'dropbox',
        provider_folder_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (assignment_id, user_id, provider)
      )
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS assignment_files (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'dropbox',
        provider_file_id TEXT NOT NULL,
        provider_folder_id TEXT,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'other',
        web_view_link TEXT,
        web_content_link TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, provider_file_id)
      )
    `)

    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_filter_type TEXT NOT NULL DEFAULT 'all'")
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_filter_priority TEXT NOT NULL DEFAULT 'all'")
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_filter_status TEXT NOT NULL DEFAULT 'all'")
    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_time TIME")
    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS progress_stage TEXT NOT NULL DEFAULT 'ai-draft'")
    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE")
    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS assignee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL")
    await query("ALTER TABLE assignment_activities ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'updated'")
    await query(`
      INSERT INTO teams (name, admin_user_id)
      SELECT
        COALESCE(NULLIF(TRIM(display_name), ''), SPLIT_PART(email, '@', 1), 'My') || '''s Team',
        id
      FROM users
      WHERE NOT EXISTS (
        SELECT 1 FROM teams WHERE teams.admin_user_id = users.id
      )
    `)
    await query(`
      INSERT INTO team_memberships (team_id, user_id, role)
      SELECT id, admin_user_id, 'admin'
      FROM teams
      ON CONFLICT (team_id, user_id) DO NOTHING
    `)
    await query(`
      UPDATE assignments
      SET team_id = teams.id
      FROM teams
      WHERE assignments.team_id IS NULL
        AND assignments.user_id = teams.admin_user_id
    `)
    await query(`
      UPDATE assignments
      SET assignee_user_id = user_id
      WHERE assignee_user_id IS NULL
    `)
    await query(`
      INSERT INTO team_memberships (team_id, user_id, role)
      SELECT DISTINCT team_id, assignee_user_id, 'member'
      FROM assignments
      WHERE team_id IS NOT NULL
        AND assignee_user_id IS NOT NULL
      ON CONFLICT (team_id, user_id) DO NOTHING
    `)
    await query("CREATE INDEX IF NOT EXISTS team_memberships_user_id_idx ON team_memberships(user_id)")
    await query("CREATE INDEX IF NOT EXISTS team_memberships_team_id_idx ON team_memberships(team_id)")
    await query("CREATE INDEX IF NOT EXISTS assignments_team_id_idx ON assignments(team_id)")
    await query("CREATE INDEX IF NOT EXISTS assignments_assignee_user_id_idx ON assignments(assignee_user_id)")
    await query(`
      UPDATE assignments
      SET category = CASE LOWER(TRIM(category))
        WHEN 'design' THEN 'Design'
        WHEN 'copywriting' THEN 'Copywriting'
        WHEN 'writing' THEN 'Copywriting'
        WHEN 'copy writing' THEN 'Copywriting'
        WHEN 'copy-writing' THEN 'Copywriting'
        WHEN 'dissertation' THEN 'Dissertation'
        WHEN 'presentation' THEN 'Presentation'
        ELSE 'Assignment'
      END
      WHERE category IS NULL
        OR category NOT IN ('Design', 'Copywriting', 'Dissertation', 'Assignment', 'Presentation')
    `)
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
