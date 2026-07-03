import { neon } from "@neondatabase/serverless"

import type { AssignmentFileCategory } from "./files.js"

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.VITE_NEON_DATABASE_URL

if (!databaseUrl) {
  console.warn("Missing NEON_DATABASE_URL. File API database calls will fail until it is configured.")
}

const sqlClient = databaseUrl ? neon(databaseUrl) : null

export function isFilesDatabaseConfigured() {
  return Boolean(databaseUrl)
}

function getSqlClient() {
  if (!sqlClient) {
    throw new Error("Missing NEON_DATABASE_URL")
  }

  return sqlClient
}

export async function query<T>(queryWithPlaceholders: string, params: readonly unknown[] = []) {
  const rows = await getSqlClient().query(queryWithPlaceholders, [...params])
  return rows as T[]
}

let initPromise: Promise<void> | null = null

export function initFilesDb() {
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
      CREATE TABLE IF NOT EXISTS dropbox_owner_connections (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_ciphertext TEXT NOT NULL,
        refresh_token_iv TEXT NOT NULL,
        refresh_token_tag TEXT NOT NULL,
        scopes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_time TIME")
    await query("ALTER TABLE assignments ADD COLUMN IF NOT EXISTS progress_stage TEXT NOT NULL DEFAULT 'ai-draft'")
    await query("ALTER TABLE assignment_activities ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'updated'")
  })()

  return initPromise
}

export type OwnerConnectionRow = {
  owner_user_id: string
  refresh_token_ciphertext: string
  refresh_token_iv: string
  refresh_token_tag: string
  scopes: string | null
}

export type AssignmentRow = {
  id: number
  user_id: string
  title: string
}

export type AssignmentFileRow = {
  id: number
  assignment_id: number
  user_id: string
  provider: "dropbox"
  provider_file_id: string
  provider_folder_id: string | null
  name: string
  mime_type: string
  size_bytes: string | number
  category: string
  web_view_link: string | null
  web_content_link: string | null
  status: string
  created_at: Date | string
  updated_at: Date | string
}

export async function getOwnerConnection() {
  await initFilesDb()
  const rows = await query<OwnerConnectionRow>(
    "SELECT * FROM dropbox_owner_connections WHERE id = 1 LIMIT 1",
  )
  return rows[0] ?? null
}

export async function saveOwnerConnection(input: {
  ownerUserId: string
  refreshTokenCiphertext: string
  refreshTokenIv: string
  refreshTokenTag: string
  scopes: string | null
}) {
  await initFilesDb()
  await query(
    `INSERT INTO dropbox_owner_connections
       (id, owner_user_id, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, scopes)
     VALUES (1, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
     SET owner_user_id = EXCLUDED.owner_user_id,
         refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
         refresh_token_iv = EXCLUDED.refresh_token_iv,
         refresh_token_tag = EXCLUDED.refresh_token_tag,
         scopes = EXCLUDED.scopes,
         updated_at = NOW()`,
    [
      input.ownerUserId,
      input.refreshTokenCiphertext,
      input.refreshTokenIv,
      input.refreshTokenTag,
      input.scopes,
    ],
  )
}

export async function getOwnerAssignment(userId: string, assignmentId: number) {
  await initFilesDb()
  const rows = await query<AssignmentRow>(
    "SELECT id, user_id, title FROM assignments WHERE user_id = $1 AND id = $2 LIMIT 1",
    [userId, assignmentId],
  )
  return rows[0] ?? null
}

export async function getAssignmentFolder(userId: string, assignmentId: number) {
  await initFilesDb()
  const rows = await query<{ provider_folder_id: string }>(
    `SELECT provider_folder_id
     FROM assignment_storage_folders
     WHERE user_id = $1
       AND assignment_id = $2
       AND provider = 'dropbox'
     LIMIT 1`,
    [userId, assignmentId],
  )
  return rows[0]?.provider_folder_id ?? null
}

export async function saveAssignmentFolder(
  userId: string,
  assignmentId: number,
  providerFolderId: string,
) {
  await initFilesDb()
  await query(
    `INSERT INTO assignment_storage_folders
       (assignment_id, user_id, provider, provider_folder_id)
     VALUES ($1, $2, 'dropbox', $3)
     ON CONFLICT (assignment_id, user_id, provider) DO UPDATE
     SET provider_folder_id = EXCLUDED.provider_folder_id,
         updated_at = NOW()`,
    [assignmentId, userId, providerFolderId],
  )
}

export async function listAssignmentFiles(userId: string, assignmentId: number) {
  await initFilesDb()
  return query<AssignmentFileRow>(
    `SELECT *
     FROM assignment_files
     WHERE user_id = $1
       AND assignment_id = $2
       AND provider = 'dropbox'
       AND status <> 'deleted'
     ORDER BY created_at DESC, id DESC`,
    [userId, assignmentId],
  )
}

export async function getAssignmentFile(userId: string, fileId: number) {
  await initFilesDb()
  const rows = await query<AssignmentFileRow>(
    `SELECT *
     FROM assignment_files
     WHERE user_id = $1 AND id = $2 AND provider = 'dropbox'
     LIMIT 1`,
    [userId, fileId],
  )
  return rows[0] ?? null
}

export async function saveAssignmentFile(input: {
  assignmentId: number
  userId: string
  providerFileId: string
  providerFolderId: string | null
  name: string
  mimeType: string
  sizeBytes: number
  category: AssignmentFileCategory
  webViewLink: string | null
  webContentLink: string | null
}) {
  await initFilesDb()
  const rows = await query<AssignmentFileRow>(
    `INSERT INTO assignment_files
       (
         assignment_id,
         user_id,
         provider,
         provider_file_id,
         provider_folder_id,
         name,
         mime_type,
         size_bytes,
         category,
         web_view_link,
         web_content_link,
         status
       )
     VALUES ($1, $2, 'dropbox', $3, $4, $5, $6, $7, $8, $9, $10, 'ready')
     ON CONFLICT (provider, provider_file_id) DO UPDATE
     SET assignment_id = EXCLUDED.assignment_id,
         user_id = EXCLUDED.user_id,
         provider_folder_id = EXCLUDED.provider_folder_id,
         name = EXCLUDED.name,
         mime_type = EXCLUDED.mime_type,
         size_bytes = EXCLUDED.size_bytes,
         category = EXCLUDED.category,
         web_view_link = EXCLUDED.web_view_link,
         web_content_link = EXCLUDED.web_content_link,
         status = 'ready',
         updated_at = NOW()
     RETURNING *`,
    [
      input.assignmentId,
      input.userId,
      input.providerFileId,
      input.providerFolderId,
      input.name,
      input.mimeType,
      input.sizeBytes,
      input.category,
      input.webViewLink,
      input.webContentLink,
    ],
  )
  return rows[0]
}

export async function markAssignmentFileDeleted(userId: string, fileId: number) {
  await initFilesDb()
  await query(
    `UPDATE assignment_files
     SET status = 'deleted',
         updated_at = NOW()
     WHERE user_id = $1 AND id = $2 AND provider = 'dropbox'`,
    [userId, fileId],
  )
}

export async function addAssignmentActivity(input: {
  assignmentId: number
  userId: string
  actorName: string
  message: string
}) {
  await initFilesDb()
  await query(
    `INSERT INTO assignment_activities
       (assignment_id, user_id, actor_name, action, message)
     VALUES ($1, $2, $3, 'updated', $4)`,
    [input.assignmentId, input.userId, input.actorName, input.message],
  )
}
