import { getAssignmentFile } from "../../server/api/db.js"
import { getDropboxTemporaryLink, getOwnerAccessToken } from "../../server/api/dropbox.js"
import { canDownloadAssignmentFile } from "../../server/api/files.js"
import {
  HttpError,
  getQueryParam,
  handleApiError,
  requireMethod,
  requireUser,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../server/api/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "GET")
    const userId = requireUser(req)
    const fileId = Number(getQueryParam(req, "fileId"))

    if (!Number.isInteger(fileId)) {
      throw new HttpError(400, "A valid file ID is required.")
    }

    const file = await getAssignmentFile(userId, fileId)
    if (!file || file.status === "deleted") {
      throw new HttpError(404, "File not found.")
    }
    if (
      !canDownloadAssignmentFile({
        userId,
        assigneeUserId: file.assignee_user_id ?? null,
        role: file.current_user_role,
      })
    ) {
      throw new HttpError(403, "Only team admins or the assignee can download this file.")
    }

    const accessToken = await getOwnerAccessToken()
    const url = await getDropboxTemporaryLink(accessToken, file.provider_file_id)
    sendJson(res, 200, { url })
  } catch (error) {
    handleApiError(res, error)
  }
}
