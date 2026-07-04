import { getAccessibleAssignment } from "../../../server/api/db.js"
import {
  getOrCreateAssignmentCategoryFolder,
  getOwnerAccessToken,
  startDropboxUploadSession,
} from "../../../server/api/dropbox.js"
import { normalizeAssignmentFileCategory, normalizeEncodedFileName } from "../../../server/api/files.js"
import {
  HttpError,
  getHeader,
  getQueryParam,
  handleApiError,
  readRawBody,
  requireMethod,
  requireUser,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../../server/api/http.js"

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024
const MAX_CHUNK_BYTES = 3 * 1024 * 1024

function canUploadCategory(input: {
  userId: string
  assigneeUserId: string
  role: "admin" | "member"
  category: string
}) {
  return input.role === "admin" || (input.assigneeUserId === input.userId && input.category === "final")
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const userId = requireUser(req)
    const assignmentId = Number(getQueryParam(req, "assignmentId"))
    const category = normalizeAssignmentFileCategory(getQueryParam(req, "category"))
    const fileName = normalizeEncodedFileName(getHeader(req.headers, "x-file-name"))
    const totalSize = Number(getHeader(req.headers, "x-file-size"))

    if (!Number.isInteger(assignmentId)) {
      throw new HttpError(400, "A valid assignment ID is required.")
    }
    if (!fileName) {
      throw new HttpError(400, "A file name is required.")
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_UPLOAD_BYTES) {
      throw new HttpError(400, "Files must be between 1 byte and 250 MB.")
    }

    const chunk = await readRawBody(req)
    if (chunk.byteLength <= 0 || chunk.byteLength > MAX_CHUNK_BYTES) {
      throw new HttpError(400, "Upload chunks must be between 1 byte and 3 MB.")
    }

    const assignment = await getAccessibleAssignment(userId, assignmentId)
    if (!assignment) {
      throw new HttpError(404, "Assignment not found.")
    }
    if (
      !canUploadCategory({
        userId,
        assigneeUserId: assignment.assignee_user_id,
        role: assignment.current_user_role,
        category,
      })
    ) {
      throw new HttpError(403, "Team members can only upload final files for assignments assigned to them.")
    }

    const accessToken = await getOwnerAccessToken()
    const providerFolderId = await getOrCreateAssignmentCategoryFolder({
      accessToken,
      userId,
      assignment,
      category,
    })
    const session = await startDropboxUploadSession(accessToken, chunk)

    sendJson(res, 200, {
      sessionId: session.session_id,
      offset: chunk.byteLength,
      providerFolderId,
    })
  } catch (error) {
    handleApiError(res, error)
  }
}
