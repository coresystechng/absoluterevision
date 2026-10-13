import { initClientSubmissionsDb } from "./client-submissions.js"
import { HttpError } from "./http.js"
import { query } from "./db.js"
import { deleteDocumentUploadFolder, getDocumentUploadFolderPath, getOwnerAccessToken } from "./dropbox.js"

/** Claim before deleting storage so concurrent conversions cannot retain missing files. */
export async function cleanupExpiredSubmissions() {
  const deadline = Date.now() + 40_000
  const owner = process.env.DROPBOX_OWNER_USER_ID
  if (!owner) throw new HttpError(503, "Submission storage is not configured.")
  await initClientSubmissionsDb()
  await query("DELETE FROM submission_email_verifications WHERE expires_at <= NOW() - INTERVAL '1 day'")
  await query("DELETE FROM submission_verification_limits WHERE started_at <= NOW() - INTERVAL '2 days'")
  const rows = await query<{ id: string; full_name: string; email: string; submitted_at: string | Date; folder_paths: string[] | null }>(`
    WITH expired AS (
      SELECT id FROM client_submissions
      WHERE converted_at IS NULL AND submitted_at <= NOW() - INTERVAL '14 days'
        AND owner_user_id = $1
        AND (cleanup_started_at IS NULL OR cleanup_started_at <= NOW() - INTERVAL '15 minutes')
      ORDER BY cleanup_started_at NULLS FIRST, submitted_at LIMIT 50 FOR UPDATE SKIP LOCKED
    ) UPDATE client_submissions s SET cleanup_started_at = NOW()
      FROM expired WHERE s.id = expired.id AND s.converted_at IS NULL
      RETURNING s.id, s.full_name, s.email, s.submitted_at,
      (SELECT array_agg(DISTINCT provider_folder_id) FROM client_submission_files
        WHERE submission_id = s.id AND provider_folder_id IS NOT NULL) AS folder_paths`, [owner])
  if (!rows.length) return { deleted: 0, failed: 0 }
  const token = await getOwnerAccessToken()
  let deleted = 0
  let failed = 0
  for (const [index, row] of rows.entries()) {
    if (Date.now() >= deadline) {
      const deferred = rows.slice(index).map((item) => item.id)
      await query("UPDATE client_submissions SET cleanup_started_at = NULL WHERE id = ANY($1::uuid[]) AND converted_at IS NULL", [deferred])
      console.warn("submission_retention_cleanup_deferred", { count: deferred.length })
      break
    }
    try {
      const folder = getDocumentUploadFolderPath({ uploadId: row.id, fullName: row.full_name,
        email: row.email, submittedAt: new Date(row.submitted_at).toISOString() })
      for (const path of row.folder_paths?.length ? row.folder_paths : [folder]) await deleteDocumentUploadFolder(token, path)
      await query("DELETE FROM client_submissions WHERE id = $1 AND converted_at IS NULL AND cleanup_started_at IS NOT NULL", [row.id])
      deleted++
    } catch {
      failed++
      console.error("submission_retention_cleanup_failed", { submissionId: row.id })
    }
  }
  return { deleted, failed }
}
