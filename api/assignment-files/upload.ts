import { addAssignmentActivity, getAccessibleAssignment, saveAssignmentFile } from "../_lib/db.js"
import {
  getOrCreateAssignmentCategoryFolder,
  getOwnerAccessToken,
  uploadDropboxFile,
} from "../_lib/dropbox.js"
import { normalizeAssignmentFileCategory, normalizeEncodedFileName } from "../_lib/files.js"
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
} from "../_lib/http.js"
import { mapAssignmentFile } from "../_lib/responses.js"

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

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
    const mimeType = getHeader(req.headers, "x-file-type")?.trim() || "application/octet-stream"
    const declaredSize = Number(getHeader(req.headers, "x-file-size"))

    if (!Number.isInteger(assignmentId)) {
      throw new HttpError(400, "A valid assignment ID is required.")
    }
    if (!fileName) {
      throw new HttpError(400, "A file name is required.")
    }
    if (!Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize > MAX_UPLOAD_BYTES) {
      throw new HttpError(400, "Files must be between 1 byte and 3 MB.")
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

    const fileBytes = await readRawBody(req)
    if (fileBytes.byteLength !== declaredSize) {
      throw new HttpError(400, "Uploaded file size does not match the request metadata.")
    }

    const accessToken = await getOwnerAccessToken()
    const providerFolderId = await getOrCreateAssignmentCategoryFolder({
      accessToken,
      userId,
      assignment,
      category,
    })
    const uploadedFile = await uploadDropboxFile({
      accessToken,
      folderPath: providerFolderId,
      fileName,
      fileBytes,
    })

    const row = await saveAssignmentFile({
      assignmentId,
      userId,
      providerFileId: uploadedFile.id,
      providerFolderId,
      name: uploadedFile.name,
      mimeType,
      sizeBytes: uploadedFile.size ?? fileBytes.byteLength,
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
