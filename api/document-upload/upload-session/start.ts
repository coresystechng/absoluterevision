import {
  createDocumentUploadId,
  handleDocumentUploadApiError,
  readDocumentUploadHeaders,
  validateUploadChunkSize,
} from "../../../server/api/document-upload.js"
import {
  getOrCreateDocumentUploadFolder,
  getOwnerAccessToken,
  startDropboxUploadSession,
} from "../../../server/api/dropbox.js"
import {
  readRawBody,
  requireMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../../server/api/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const headers = readDocumentUploadHeaders(req)
    const chunk = await readRawBody(req)
    validateUploadChunkSize(chunk.byteLength)

    const submittedAt = new Date().toISOString()
    const uploadId = createDocumentUploadId(submittedAt)
    const accessToken = await getOwnerAccessToken()
    await getOrCreateDocumentUploadFolder({
      accessToken,
      uploadId,
      fullName: headers.fullName,
      email: headers.email,
      submittedAt,
    })
    const session = await startDropboxUploadSession(accessToken, chunk)

    sendJson(res, 200, {
      sessionId: session.session_id,
      offset: chunk.byteLength,
      uploadId,
      submittedAt,
    })
  } catch (error) {
    handleDocumentUploadApiError(res, error)
  }
}
