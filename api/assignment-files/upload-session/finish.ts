import { addAssignmentActivity, getOwnerAssignment, saveAssignmentFile } from "../../_lib/db.js"
import {
  finishDropboxUploadSession,
  getOrCreateAssignmentCategoryFolder,
  getOwnerAccessToken,
} from "../../_lib/dropbox.js"
import { normalizeAssignmentFileCategory, normalizeEncodedFileName } from "../../_lib/files.js"
import {
  HttpError,
  getActorName,
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
import { mapAssignmentFile } from "../../_lib/responses.js"

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024
const MAX_CHUNK_BYTES = 3 * 1024 * 1024

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const userId = requireUser(req)
    const assignmentId = Number(getQueryParam(req, "assignmentId"))
    const category = normalizeAssignmentFileCategory(getQueryParam(req, "category"))
    const sessionId = getQueryParam(req, "sessionId")?.trim()
    const offset = Number(getQueryParam(req, "offset"))
    const fileName = normalizeEncodedFileName(getHeader(req.headers, "x-file-name"))
    const mimeType = getHeader(req.headers, "x-file-type")?.trim() || "application/octet-stream"
    const totalSize = Number(getHeader(req.headers, "x-file-size"))

    if (!Number.isInteger(assignmentId)) {
      throw new HttpError(400, "A valid assignment ID is required.")
    }
    if (!sessionId) {
      throw new HttpError(400, "A Dropbox upload session ID is required.")
    }
    if (!fileName) {
      throw new HttpError(400, "A file name is required.")
    }
    if (!Number.isFinite(offset) || offset < 0) {
      throw new HttpError(400, "A valid upload offset is required.")
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_UPLOAD_BYTES) {
      throw new HttpError(400, "Files must be between 1 byte and 250 MB.")
    }

    const chunk = await readRawBody(req)
    if (chunk.byteLength <= 0 || chunk.byteLength > MAX_CHUNK_BYTES) {
      throw new HttpError(400, "Upload chunks must be between 1 byte and 3 MB.")
    }
    if (offset + chunk.byteLength !== totalSize) {
      throw new HttpError(400, "Final upload chunk does not match the file size.")
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
    const uploadedFile = await finishDropboxUploadSession({
      accessToken,
      sessionId,
      offset,
      folderPath: providerFolderId,
      fileName,
      fileBytes: chunk,
    })

    const row = await saveAssignmentFile({
      assignmentId,
      userId,
      providerFileId: uploadedFile.id,
      providerFolderId,
      name: uploadedFile.name,
      mimeType,
      sizeBytes: uploadedFile.size ?? totalSize,
      category,
      webViewLink: null,
      webContentLink: null,
    })
    const actorName = getActorName(req)
    await addAssignmentActivity({
      assignmentId,
      userId,
      actorName,
      message: `${actorName} uploaded ${uploadedFile.name} to assignment files`,
    })

    sendJson(res, 200, { file: mapAssignmentFile(row) })
  } catch (error) {
    handleApiError(res, error)
  }
}
