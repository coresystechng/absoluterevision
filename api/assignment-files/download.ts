import { getAssignmentFile } from "../_lib/db.js"
import { getDropboxTemporaryLink, getOwnerAccessToken } from "../_lib/dropbox.js"
import {
  HttpError,
  getQueryParam,
  handleApiError,
  requireMethod,
  requireOwner,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "GET")
    const userId = requireOwner(req)
    const fileId = Number(getQueryParam(req, "fileId"))

    if (!Number.isInteger(fileId)) {
      throw new HttpError(400, "A valid file ID is required.")
    }

    const file = await getAssignmentFile(userId, fileId)
    if (!file || file.status === "deleted") {
      throw new HttpError(404, "File not found.")
    }

    const accessToken = await getOwnerAccessToken()
    const url = await getDropboxTemporaryLink(accessToken, file.provider_file_id)
    sendJson(res, 200, { url })
  } catch (error) {
    handleApiError(res, error)
  }
}
