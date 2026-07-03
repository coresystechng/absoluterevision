import { getOwnerAssignment } from "../../_lib/db.js"
import {
  getOrCreateAssignmentCategoryFolder,
  getOwnerAccessToken,
  startDropboxUploadSession,
} from "../../_lib/dropbox.js"
import { normalizeAssignmentFileCategory, normalizeEncodedFileName } from "../../_lib/files.js"
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
} from "../../_lib/http.js"

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024
const MAX_CHUNK_BYTES = 3 * 1024 * 1024

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

    const assignment = await getOwnerAssignment(userId, assignmentId)
    if (!assignment) {
      throw new HttpError(404, "Assignment not found.")
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
