import { appendDropboxUploadSession, getOwnerAccessToken } from "../../../server/api/dropbox.js"
import {
  HttpError,
  getQueryParam,
  handleApiError,
  readRawBody,
  requireMethod,
  requireUser,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../../server/api/http.js"

const MAX_CHUNK_BYTES = 3 * 1024 * 1024

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    requireUser(req)

    const sessionId = getQueryParam(req, "sessionId")?.trim()
    const offset = Number(getQueryParam(req, "offset"))
    if (!sessionId) {
      throw new HttpError(400, "A Dropbox upload session ID is required.")
    }
    if (!Number.isFinite(offset) || offset < 0) {
      throw new HttpError(400, "A valid upload offset is required.")
    }

    const chunk = await readRawBody(req)
    if (chunk.byteLength <= 0 || chunk.byteLength > MAX_CHUNK_BYTES) {
      throw new HttpError(400, "Upload chunks must be between 1 byte and 3 MB.")
    }

    const accessToken = await getOwnerAccessToken()
    await appendDropboxUploadSession({
      accessToken,
      sessionId,
      offset,
      fileBytes: chunk,
    })

    sendJson(res, 200, { offset: offset + chunk.byteLength })
  } catch (error) {
    handleApiError(res, error)
  }
}
