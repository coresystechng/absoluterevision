import { enforceVerificationLimit } from "./submission-verification.js"
import { createHash, randomBytes, randomUUID } from "node:crypto"

import type { ClientSubmission, ClientSubmissionsPage, SubmissionAssignmentInput, SubmissionTeam } from "../../shared/client-submissions.js"
import { getDocumentUploadSelectionError } from "../../shared/document-uploads.js"
import { getAssignmentWorkflow, isAssignmentType } from "../../shared/assignment-workflows.js"
import { initFilesDb, query } from "./db.js"
import { normalizeFileName } from "./files.js"
import { HttpError, getHeader, type ApiRequest } from "./http.js"
import type { DocumentUploadHeaders } from "./document-upload.js"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

let initPromise: Promise<void> | null = null
export function submissionBrowserRole(serverUrl: string | undefined, browserUrl: string | undefined) {
  try {
    const serverRole = serverUrl ? decodeURIComponent(new URL(serverUrl).username) : ""
    const browserRole = browserUrl ? decodeURIComponent(new URL(browserUrl).username) : ""
    if (serverRole && browserRole && serverRole !== browserRole) return browserRole
  } catch { /* Report configuration errors without exposing connection strings. */ }
  throw new HttpError(503, "Client submissions require separate server and browser database roles. See the client submissions section in SETUP.md.")
}

export function initClientSubmissionsDb() {
  initPromise ??= (async () => {
    const browserRole = submissionBrowserRole(process.env.NEON_DATABASE_URL, process.env.VITE_NEON_BROWSER_URL)
    await initFilesDb()
    const permissions = await query<{ unsafe: boolean }>(`SELECT (r.rolsuper OR pg_has_role(r.oid, current_user, 'MEMBER')) AS unsafe
      FROM pg_roles r WHERE r.rolname = $1`, [browserRole])
    if (!permissions[0] || permissions[0].unsafe) throw new HttpError(503, "The browser database role must not inherit the server role or have superuser access.")
    await query(`CREATE TABLE IF NOT EXISTS client_submissions (
      id UUID PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      converted_at TIMESTAMPTZ,
      assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
      team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL
    )`)
    await query(`CREATE TABLE IF NOT EXISTS client_submission_files (
      submission_id UUID NOT NULL REFERENCES client_submissions(id) ON DELETE CASCADE,
      file_index SMALLINT NOT NULL CHECK (file_index BETWEEN 0 AND 2),
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 262144000),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
      provider_file_id TEXT UNIQUE,
      provider_folder_id TEXT,
      uploaded_name TEXT,
      session_id TEXT,
      PRIMARY KEY (submission_id, file_index)
    )`)
    await query(`CREATE TABLE IF NOT EXISTS submission_email_verifications (
      id UUID PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      attempts INTEGER NOT NULL DEFAULT 0, verified_at TIMESTAMPTZ, proof_hash TEXT UNIQUE, used_at TIMESTAMPTZ
    )`)
    await query(`CREATE TABLE IF NOT EXISTS submission_verification_limits (
      key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, started_at TIMESTAMPTZ NOT NULL
    )`)
    await query("CREATE INDEX IF NOT EXISTS submission_verifications_expiry_idx ON submission_email_verifications(expires_at)")
    await query("ALTER TABLE client_submissions ADD COLUMN IF NOT EXISTS cleanup_started_at TIMESTAMPTZ")
    await query("CREATE INDEX IF NOT EXISTS client_submissions_expiry_idx ON client_submissions(submitted_at) WHERE converted_at IS NULL")
    await query("CREATE INDEX IF NOT EXISTS client_submissions_inbox_idx ON client_submissions(owner_user_id, submitted_at DESC, id DESC)")
    const quotedRole = '"' + browserRole.replaceAll('"', '""') + '"'
    await query(`REVOKE ALL ON client_submissions, client_submission_files, submission_email_verifications, submission_verification_limits FROM PUBLIC, ${quotedRole}`)
    const access = await query<{ unsafe: boolean }>(`SELECT
      has_table_privilege($1, 'client_submissions', 'SELECT, INSERT, UPDATE, DELETE') OR
      has_table_privilege($1, 'client_submission_files', 'SELECT, INSERT, UPDATE, DELETE') OR
      has_table_privilege($1, 'submission_email_verifications', 'SELECT, INSERT, UPDATE, DELETE') OR
      has_table_privilege($1, 'submission_verification_limits', 'SELECT, INSERT, UPDATE, DELETE') AS unsafe`, [browserRole])
    if (access[0]?.unsafe) throw new HttpError(503, "Remove inherited access to private submission tables from the browser database role.")
  })().catch((error) => { initPromise = null; throw error })
  return initPromise
}

function ownerUserId() {
  const id = process.env.DROPBOX_OWNER_USER_ID
  if (!id) throw new HttpError(503, "Client submissions are temporarily unavailable.")
  return id
}

export function validateSubmissionId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new HttpError(400, "A valid submission ID is required.")
  return value
}

export async function requireSubmissionsAdmin(userId: string) {
  await initClientSubmissionsDb()
  const owner = ownerUserId()
  if (userId === owner) return owner
  const rows = await query<{ id: number }>(
    `SELECT t.id FROM teams t JOIN team_memberships tm ON tm.team_id = t.id
     WHERE t.admin_user_id = $1 AND tm.user_id = $2 AND tm.role = 'admin' LIMIT 1`, [owner, userId],
  )
  if (!rows.length) throw new HttpError(403, "Only the Dropbox owner and admins of their teams can access client submissions.")
  return owner
}

export function normalizeSubmissionIntake(body: Record<string, unknown>) {
  const fullName = typeof body.fullName === "string" ? body.fullName.replace(/\s+/g, " ").trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (fullName.length < 2 || fullName.length > 120) throw new HttpError(400, "Full Name must be between 2 and 120 characters.")
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid Email Address.")
  if (!Array.isArray(body.files) || body.files.length > 3) throw new HttpError(400, "Choose between 1 and 3 files.")
  const files = body.files.map((value: unknown, index) => {
    if (!value || typeof value !== "object") throw new HttpError(400, "Invalid file details.")
    const file = value as Record<string, unknown>
    const name = normalizeFileName(file.name)
    const size = typeof file.size === "number" ? file.size : NaN
    const mimeType = typeof file.mimeType === "string" && file.mimeType.length <= 255 ? file.mimeType : "application/octet-stream"
    return { index, name, size, mimeType }
  })
  const error = getDocumentUploadSelectionError(files)
  if (error) throw new HttpError(400, error)
  return { fullName, email, files }
}

export async function createSubmissionIntake(body: Record<string, unknown>) {
  const input = normalizeSubmissionIntake(body)
  const owner = ownerUserId()
  await initClientSubmissionsDb()
  const proof = typeof body.verificationToken === "string" ? body.verificationToken : ""
  if (!/^[a-f0-9]{64}$/.test(proof)) throw new HttpError(403, "Verify your email before submitting files.")
  const valid = await query("SELECT id FROM submission_email_verifications WHERE email = $1 AND proof_hash = $2 AND verified_at IS NOT NULL AND used_at IS NULL AND expires_at > NOW()", [input.email, hashToken(proof)])
  if (!valid.length) throw new HttpError(403, "Email verification has expired or already been used. Verify your email again.")
  await enforceVerificationLimit(`submit-email:${input.email}`, 3, 86_400_000)
  const submissionId = randomUUID()
  const token = randomBytes(32).toString("hex")
  const created = await query(`WITH verified AS (
    UPDATE submission_email_verifications SET used_at = NOW()
    WHERE email = $5 AND proof_hash = $7 AND verified_at IS NOT NULL AND used_at IS NULL AND expires_at > NOW()
    RETURNING id
  ), submission AS (
    INSERT INTO client_submissions (id, owner_user_id, token_hash, full_name, email)
    SELECT $1, $2, $3, $4, $5 FROM verified RETURNING id
  ) INSERT INTO client_submission_files (submission_id, file_index, name, mime_type, size_bytes)
    SELECT submission.id, file.index, file.name, file."mimeType", file.size
    FROM submission CROSS JOIN jsonb_to_recordset($6::jsonb)
    AS file(index smallint, name text, "mimeType" text, size bigint) RETURNING file_index`,
  [submissionId, owner, hashToken(token), input.fullName, input.email, JSON.stringify(input.files), hashToken(proof)])
  if (!created.length) throw new HttpError(403, "Email verification has expired or already been used. Verify your email again.")
  return { submissionId, token }
}

export function readSubmissionUploadAccess(req: ApiRequest) {
  const submissionId = validateSubmissionId(getHeader(req.headers, "x-submission-id"))
  const token = getHeader(req.headers, "x-submission-token") ?? ""
  const indexHeader = getHeader(req.headers, "x-submission-file-index")
  if (!/^[a-f0-9]{64}$/.test(token) || !indexHeader || !/^[0-2]$/.test(indexHeader)) throw new HttpError(400, "Valid submission upload credentials are required.")
  return { submissionId, token, fileIndex: Number(indexHeader) }
}

type UploadRow = {
  name: string; mime_type: string; size_bytes: string | number; status: string
  uploaded_name: string | null; session_id: string | null; submitted_at: string | Date
  full_name: string; email: string
}

export async function authorizeSubmissionUpload(req: ApiRequest, headers?: DocumentUploadHeaders) {
  const access = readSubmissionUploadAccess(req)
  await initClientSubmissionsDb()
  const rows = await query<UploadRow>(`SELECT f.*, s.submitted_at, s.full_name, s.email FROM client_submissions s
    JOIN client_submission_files f ON f.submission_id = s.id
    WHERE s.id = $1 AND s.token_hash = $2 AND f.file_index = $3
      AND s.owner_user_id = $4 AND s.converted_at IS NULL
      AND s.submitted_at > NOW() - INTERVAL '24 hours'`,
  [access.submissionId, hashToken(access.token), access.fileIndex, ownerUserId()])
  const file = rows[0]
  if (!file) throw new HttpError(403, "This submission upload has expired or is no longer available.")
  if (headers && (headers.fileName !== file.name || headers.totalSize !== Number(file.size_bytes) || headers.mimeType !== file.mime_type || headers.fullName !== file.full_name || headers.email !== file.email)) {
    throw new HttpError(400, "File details do not match this submission.")
  }
  return { ...access, file, submittedAt: new Date(file.submitted_at).toISOString() }
}

export async function saveSubmissionSession(req: ApiRequest, sessionId: string) {
  const access = readSubmissionUploadAccess(req)
  await query(`UPDATE client_submission_files f SET session_id = $4, status = 'pending'
    FROM client_submissions s WHERE s.id = f.submission_id AND s.id = $1
    AND s.token_hash = $2 AND f.file_index = $3 AND s.converted_at IS NULL`,
  [access.submissionId, hashToken(access.token), access.fileIndex, sessionId])
}

export async function recordSubmissionUpload(req: ApiRequest, input: { providerFileId: string; folderPath: string; name: string; sizeBytes: number }) {
  const access = readSubmissionUploadAccess(req)
  const rows = await query<{ file_index: number }>(`WITH source AS (
    SELECT id FROM client_submissions WHERE id = $1 AND token_hash = $2 AND converted_at IS NULL FOR UPDATE
  ) UPDATE client_submission_files f SET status = 'ready', provider_file_id = $4,
    provider_folder_id = $5, uploaded_name = $6
    FROM source WHERE f.submission_id = source.id AND f.file_index = $3 AND f.size_bytes = $7 RETURNING f.file_index`,
  [access.submissionId, hashToken(access.token), access.fileIndex, input.providerFileId, input.folderPath, input.name, input.sizeBytes])
  if (!rows.length) throw new HttpError(409, "The submission could not be updated. Please contact support.")
}

export async function finalizeSubmissionIntake(body: Record<string, unknown>) {
  const id = validateSubmissionId(body.submissionId)
  const token = typeof body.token === "string" ? body.token : ""
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, "Valid submission credentials are required.")
  await initClientSubmissionsDb()
  const rows = await query<{ id: string }>(`WITH source AS (
    SELECT id FROM client_submissions WHERE id = $1 AND token_hash = $2
    AND converted_at IS NULL AND submitted_at > NOW() - INTERVAL '24 hours' FOR UPDATE
  ), failed AS (
    UPDATE client_submission_files f SET status = 'failed' FROM source
    WHERE f.submission_id = source.id AND f.status = 'pending'
  ) SELECT id FROM source`, [id, hashToken(token)])
  if (!rows.length) throw new HttpError(403, "This submission is no longer available.")
}

export async function retrySubmissionIntake(body: Record<string, unknown>) {
  const id = validateSubmissionId(body.submissionId)
  const token = typeof body.token === "string" ? body.token : ""
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, "Valid submission credentials are required.")
  await initClientSubmissionsDb()
  const rows = await query<{ id: string }>(`WITH source AS (
    SELECT id FROM client_submissions WHERE id = $1 AND token_hash = $2
    AND converted_at IS NULL AND submitted_at > NOW() - INTERVAL '24 hours' FOR UPDATE
  ), pending AS (
    UPDATE client_submission_files f SET status = 'pending' FROM source
    WHERE f.submission_id = source.id AND f.status = 'failed'
  ) SELECT id FROM source`, [id, hashToken(token)])
  if (!rows.length) throw new HttpError(403, "This submission has expired or has already been assigned. Please contact support.")
}

const visibleSubmission = `s.owner_user_id = $2 AND s.cleanup_started_at IS NULL AND (s.converted_at IS NOT NULL OR s.submitted_at > NOW() - INTERVAL '14 days') AND (s.converted_at IS NULL OR $1 = $2 OR EXISTS (
  SELECT 1 FROM team_memberships WHERE team_id = s.team_id AND user_id = $1 AND role = 'admin'
))`

export async function getSubmissionTeams(userId: string, owner: string) {
  return query<SubmissionTeam>(`SELECT t.id, t.name, COALESCE(jsonb_agg(jsonb_build_object(
    'userId', u.id, 'email', u.email, 'displayName', u.display_name) ORDER BY u.email), '[]'::jsonb) AS members
    FROM teams t JOIN team_memberships access ON access.team_id = t.id AND access.user_id = $1 AND access.role = 'admin'
    JOIN team_memberships tm ON tm.team_id = t.id JOIN users u ON u.id = tm.user_id
    WHERE t.admin_user_id = $2 GROUP BY t.id ORDER BY t.name`, [userId, owner])
}

export async function listClientSubmissions(userId: string, options: { search: string; status: string; cursor: string | null }): Promise<ClientSubmissionsPage> {
  const owner = await requireSubmissionsAdmin(userId)
  if (options.search.length > 200 || !["all", "new", "converted"].includes(options.status)) throw new HttpError(400, "Invalid inbox filters.")
  let before: string | null = null
  let beforeId: string | null = null
  if (options.cursor) {
    const [timestamp, id] = options.cursor.split("|")
    if (!timestamp || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new HttpError(400, "Invalid inbox cursor.")
    before = timestamp
    beforeId = validateSubmissionId(id)
  }
  const [rows, teams] = await Promise.all([
    query<ClientSubmission & { cursorTimestamp: string }>(`SELECT s.id, s.full_name AS "fullName", s.email, s.submitted_at AS "submittedAt",
      to_char(s.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTimestamp",
      s.converted_at AS "convertedAt", s.assignment_id AS "assignmentId", s.team_id AS "teamId",
      (SELECT jsonb_agg(jsonb_build_object('index', f.file_index, 'name', COALESCE(f.uploaded_name, f.name),
        'mimeType', f.mime_type, 'sizeBytes', f.size_bytes, 'status', CASE
          WHEN f.status = 'pending' AND s.submitted_at <= NOW() - INTERVAL '24 hours' THEN 'failed'
          ELSE f.status END) ORDER BY f.file_index)
       FROM client_submission_files f WHERE f.submission_id = s.id) AS files
      FROM client_submissions s WHERE ${visibleSubmission}
      AND ($3 = '' OR strpos(lower(s.full_name || ' ' || s.email), lower($3)) > 0
        OR EXISTS (SELECT 1 FROM client_submission_files f WHERE f.submission_id = s.id AND strpos(lower(f.name), lower($3)) > 0))
      AND ($4 = 'all' OR ($4 = 'new' AND s.converted_at IS NULL) OR ($4 = 'converted' AND s.converted_at IS NOT NULL))
      AND ($5::timestamptz IS NULL OR (s.submitted_at, s.id) < ($5::timestamptz, $6::uuid))
      ORDER BY s.submitted_at DESC, s.id DESC LIMIT 26`, [userId, owner, options.search.trim(), options.status, before, beforeId]),
    getSubmissionTeams(userId, owner),
  ])
  const submissions = rows.slice(0, 25).map((row) => ({
    id: row.id, fullName: row.fullName, email: row.email, assignmentId: row.assignmentId, teamId: row.teamId, files: row.files,
    submittedAt: new Date(row.submittedAt).toISOString(),
    convertedAt: row.convertedAt ? new Date(row.convertedAt).toISOString() : null,
  }))
  const last = submissions.at(-1)
  return { submissions, teams, nextCursor: rows.length > 25 && last ? `${rows[24].cursorTimestamp}|${last.id}` : null }
}

export async function getSubmissionDownloadFile(userId: string, submissionId: unknown, index: unknown) {
  const owner = await requireSubmissionsAdmin(userId)
  const id = validateSubmissionId(submissionId)
  const fileIndex = Number(index)
  if (index === null || index === undefined || !Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex > 2) throw new HttpError(400, "Select a valid file.")
  const rows = await query<{ provider_file_id: string }>(`SELECT f.provider_file_id FROM client_submissions s
    JOIN client_submission_files f ON f.submission_id = s.id WHERE ${visibleSubmission}
    AND s.id = $3 AND f.file_index = $4 AND f.status = 'ready'`, [userId, owner, id, fileIndex])
  if (!rows[0]) throw new HttpError(404, "File not found.")
  return rows[0].provider_file_id
}

export function normalizeSubmissionAssignment(body: Record<string, unknown>): SubmissionAssignmentInput {
  const submissionId = validateSubmissionId(body.submissionId)
  const teamId = body.teamId
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const assigneeUserId = typeof body.assigneeUserId === "string" ? body.assigneeUserId.trim() : ""
  if (typeof teamId !== "number" || !Number.isSafeInteger(teamId) || teamId <= 0) throw new HttpError(400, "Select a valid team.")
  if (!title || title.length > 200 || !assigneeUserId || assigneeUserId.length > 200) throw new HttpError(400, "Enter a title and select an assignee.")
  if (!isAssignmentType(body.category)) throw new HttpError(400, "Select a valid assignment type.")
  if (!["low", "medium", "high"].includes(String(body.priority))) throw new HttpError(400, "Select a valid priority.")
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate)) throw new HttpError(400, "Enter a valid deadline.")
  const notes = typeof body.notes === "string" ? body.notes.trim() : ""
  if (notes.length > 10000) throw new HttpError(400, "Notes must be 10,000 characters or fewer.")
  return { submissionId, teamId, title, assigneeUserId, category: body.category, priority: body.priority as SubmissionAssignmentInput["priority"], dueDate, notes }
}

export async function convertClientSubmission(user: { id: string; email: string; name: string | null }, body: Record<string, unknown>) {
  const input = normalizeSubmissionAssignment(body)
  const owner = await requireSubmissionsAdmin(user.id)
  const teams = await getSubmissionTeams(user.id, owner)
  const team = teams.find((item) => item.id === input.teamId)
  if (!team || !team.members.some((member) => member.userId === input.assigneeUserId)) throw new HttpError(403, "Select a team you administer and one of its members.")
  const stage = getAssignmentWorkflow(input.category)[0].value
  // One statement holds the submission lock and commits the assignment, attachments,
  // conversion marker, and activity together. Repeated clicks cannot duplicate work.
  const rows = await query<{ assignment_id: number }>(`WITH source AS (
    SELECT s.* FROM client_submissions s WHERE s.id = $1 AND ${visibleSubmission.replaceAll("$1", "$3")}
    AND s.converted_at IS NULL AND s.cleanup_started_at IS NULL AND s.submitted_at > NOW() - INTERVAL '14 days' FOR UPDATE
  ), created AS (
    INSERT INTO assignments (user_id, team_id, assignee_user_id, title, category, priority, status, progress_stage, progress, due_date, notes)
    SELECT $3, $4, $5, $6, $7, $8, 'not-started', $9, 0, $10::date,
      'Client: ' || source.full_name || E'\nEmail: ' || source.email || E'\n\n' || $11
    FROM source WHERE EXISTS (SELECT 1 FROM client_submission_files WHERE submission_id = source.id AND status = 'ready')
    AND NOT EXISTS (SELECT 1 FROM client_submission_files WHERE submission_id = source.id AND status = 'pending'
      AND source.submitted_at > NOW() - INTERVAL '24 hours')
    AND EXISTS (SELECT 1 FROM teams t JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = $4 AND t.admin_user_id = $2 AND tm.user_id = $3 AND tm.role = 'admin')
    AND EXISTS (SELECT 1 FROM team_memberships WHERE team_id = $4 AND user_id = $5)
    RETURNING id
  ), linked AS (
    UPDATE client_submissions s SET assignment_id = created.id, team_id = $4, converted_at = NOW()
    FROM created WHERE s.id = $1 RETURNING s.assignment_id
  ), files AS (
    INSERT INTO assignment_files (assignment_id, user_id, provider, provider_file_id, provider_folder_id, name, mime_type, size_bytes, category)
    SELECT created.id, $3, 'dropbox', f.provider_file_id, f.provider_folder_id, COALESCE(f.uploaded_name, f.name), f.mime_type, f.size_bytes, 'brief'
    FROM created JOIN client_submission_files f ON f.submission_id = $1 AND f.status = 'ready'
  ), activity AS (
    INSERT INTO assignment_activities (assignment_id, user_id, actor_name, action, message)
    SELECT id, $3, $12, 'created', 'Created from client submission' FROM created
  ) SELECT assignment_id FROM linked`,
  [input.submissionId, owner, user.id, input.teamId, input.assigneeUserId, input.title, input.category, input.priority, stage, input.dueDate, input.notes, user.name || user.email])
  if (rows[0]) return rows[0].assignment_id
  const existing = await query<{ assignment_id: number | null; converted_at: string | null }>(
    `SELECT s.assignment_id, s.converted_at FROM client_submissions s WHERE s.id = $3 AND ${visibleSubmission}`, [user.id, owner, input.submissionId],
  )
  if (existing[0]?.assignment_id && existing[0].converted_at) return existing[0].assignment_id
  throw new HttpError(409, "Wait for uploads to finish before converting this submission.")
}


export async function countNewClientSubmissions(userId: string): Promise<number> {
  const owner = await requireSubmissionsAdmin(userId)
  const rows = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM client_submissions WHERE owner_user_id = $1 AND converted_at IS NULL AND cleanup_started_at IS NULL AND submitted_at > NOW() - INTERVAL '14 days'",
    [owner],
  )
  return rows[0]?.count ?? 0
}
