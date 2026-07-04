import {
  handleDocumentUploadApiError,
  validateUploadChunkSize,
} from "../../../server/api/document-upload.js"
import { appendDropboxUploadSession, getOwnerAccessToken } from "../../../server/api/dropbox.js"
import {
  HttpError,
  getQueryParam,
  readRawBody,
  requireMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../../server/api/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const sessionId = getQueryParam(req, "sessionId")?.trim()
    const offset = Number(getQueryParam(req, "offset"))
    if (!sessionId) {
      throw new HttpError(400, "A Dropbox upload session ID is required.")
    }
    if (!Number.isFinite(offset) || offset < 0) {
      throw new HttpError(400, "A valid upload offset is required.")
    }

    const chunk = await readRawBody(req)
    validateUploadChunkSize(chunk.byteLength)

    const accessToken = await getOwnerAccessToken()
    await appendDropboxUploadSession({
      accessToken,
      sessionId,
      offset,
      fileBytes: chunk,
    })

    sendJson(res, 200, { offset: offset + chunk.byteLength })
  } catch (error) {
    handleDocumentUploadApiError(res, error)
  }
}
