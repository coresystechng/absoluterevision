import {
  addAssignmentActivity,
  getAssignmentFile,
  getOwnerAssignment,
  listAssignmentFiles,
  markAssignmentFileDeleted,
} from "./_lib/db"
import { deleteDropboxFile, getOwnerAccessToken } from "./_lib/dropbox"
import {
  HttpError,
  getActorName,
  getQueryParam,
  handleApiError,
  requireOwner,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/http"
import { mapAssignmentFile } from "./_lib/responses"

async function handleGet(req: ApiRequest, res: ApiResponse, userId: string) {
  const assignmentId = Number(getQueryParam(req, "assignmentId"))
  if (!Number.isInteger(assignmentId)) {
    throw new HttpError(400, "A valid assignment ID is required.")
  }

  const assignment = await getOwnerAssignment(userId, assignmentId)
  if (!assignment) {
    throw new HttpError(404, "Assignment not found.")
  }

  const files = await listAssignmentFiles(userId, assignmentId)
  sendJson(res, 200, { files: files.map(mapAssignmentFile) })
}

async function handleDelete(req: ApiRequest, res: ApiResponse, userId: string) {
  const fileId = Number(getQueryParam(req, "fileId"))
  if (!Number.isInteger(fileId)) {
    throw new HttpError(400, "A valid file ID is required.")
  }

  const file = await getAssignmentFile(userId, fileId)
  if (!file) {
    throw new HttpError(404, "File not found.")
  }

  const accessToken = await getOwnerAccessToken()
  await deleteDropboxFile(accessToken, file.provider_file_id)
  await markAssignmentFileDeleted(userId, fileId)
  const actorName = getActorName(req)
  await addAssignmentActivity({
    assignmentId: file.assignment_id,
    userId,
    actorName,
    message: `${actorName} removed ${file.name} from assignment files`,
  })

  sendJson(res, 200, { ok: true })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const userId = requireOwner(req)

    if (req.method === "GET") {
      await handleGet(req, res, userId)
      return
    }

    if (req.method === "DELETE") {
      await handleDelete(req, res, userId)
      return
    }

    throw new HttpError(405, "Use GET or DELETE for this endpoint.")
  } catch (error) {
    handleApiError(res, error)
  }
}
