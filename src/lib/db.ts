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

/** The deployment initializes schema using the server connection. */
export function initDb() {
  initPromise ??= query("SELECT id, active_team_id, dashboard_filter_types FROM users LIMIT 0")
    .then(() => undefined)
    .catch((error) => { initPromise = null; throw error })
  return initPromise
}
