import {
  createDocumentUploadId,
  createDocumentUploadMetadataFile,
  handleDocumentUploadApiError,
  normalizeDocumentUploadId,
  normalizeSubmittedAt,
  readDocumentUploadHeaders,
  validateUploadChunkSize,
} from "../../../server/api/document-upload.js"
import {
  appendDropboxUploadSession,
  finishDropboxUploadSession,
  getOrCreateDocumentUploadFolder,
  getOwnerAccessToken,
  startDropboxUploadSession,
  uploadDropboxFile,
} from "../../../server/api/dropbox.js"
import {
  HttpError,
  getQueryParam,
  readRawBody,
  requireMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../../server/api/http.js"

async function start(req: ApiRequest, res: ApiResponse) {
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
}

async function append(req: ApiRequest, res: ApiResponse) {
  const sessionId = getQueryParam(req, "sessionId")?.trim()
  const offset = Number(getQueryParam(req, "offset"))
  if (!sessionId) throw new HttpError(400, "A Dropbox upload session ID is required.")
  if (!Number.isFinite(offset) || offset < 0) throw new HttpError(400, "A valid upload offset is required.")

  const chunk = await readRawBody(req)
  validateUploadChunkSize(chunk.byteLength)
  const accessToken = await getOwnerAccessToken()
  await appendDropboxUploadSession({ accessToken, sessionId, offset, fileBytes: chunk })
  sendJson(res, 200, { offset: offset + chunk.byteLength })
}

async function finish(req: ApiRequest, res: ApiResponse) {
  const headers = readDocumentUploadHeaders(req)
  const sessionId = getQueryParam(req, "sessionId")?.trim()
  const offset = Number(getQueryParam(req, "offset"))
  const uploadId = normalizeDocumentUploadId(getQueryParam(req, "uploadId"))
  const submittedAt = normalizeSubmittedAt(getQueryParam(req, "submittedAt"))
  if (!sessionId) throw new HttpError(400, "A Dropbox upload session ID is required.")
  if (!Number.isFinite(offset) || offset < 0) throw new HttpError(400, "A valid upload offset is required.")

  const chunk = await readRawBody(req)
  validateUploadChunkSize(chunk.byteLength)
  if (offset + chunk.byteLength !== headers.totalSize) {
    throw new HttpError(400, "Final upload chunk does not match the file size.")
  }

  const accessToken = await getOwnerAccessToken()
  const folderPath = await getOrCreateDocumentUploadFolder({
    accessToken,
    uploadId,
    fullName: headers.fullName,
    email: headers.email,
    submittedAt,
  })
  const uploadedFile = await finishDropboxUploadSession({
    accessToken,
    sessionId,
    offset,
    folderPath,
    fileName: headers.fileName,
    fileBytes: chunk,
  })

  await uploadDropboxFile({
    accessToken,
    folderPath,
    fileName: "submission-details.json",
    fileBytes: createDocumentUploadMetadataFile({
      fullName: headers.fullName,
      email: headers.email,
      fileName: headers.fileName,
      mimeType: headers.mimeType,
      sizeBytes: uploadedFile.size ?? headers.totalSize,
      uploadId,
      submittedAt,
      providerFileId: uploadedFile.id,
    }),
  })

  sendJson(res, 200, {
    upload: {
      fileName: uploadedFile.name,
      sizeBytes: uploadedFile.size ?? headers.totalSize,
      submittedAt,
    },
  })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const action = getQueryParam(req, "action")
    if (action === "start") return await start(req, res)
    if (action === "append") return await append(req, res)
    if (action === "finish") return await finish(req, res)
    throw new HttpError(404, "Upload action not found.")
  } catch (error) {
    handleDocumentUploadApiError(res, error)
  }
}
