import type { AssignmentFileRow } from "./db.js"
import { normalizeAssignmentFileCategory } from "./files.js"

function toIsoDateTime(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function mapAssignmentFile(row: AssignmentFileRow) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    provider: row.provider,
    providerFileId: row.provider_file_id,
    providerFolderId: row.provider_folder_id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    category: normalizeAssignmentFileCategory(row.category),
    webViewLink: row.web_view_link,
    webContentLink: row.web_content_link,
    status: row.status,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
  }
}
