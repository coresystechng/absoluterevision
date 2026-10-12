import {
  createDocumentUploadMetadataFile,
  handleDocumentUploadApiError,
  readDocumentUploadHeaders,
} from "../server/api/document-upload.js"
import { authorizeSubmissionUpload, recordSubmissionUpload } from "../server/api/client-submissions.js"
import {
  getOrCreateDocumentUploadFolder,
  getOwnerAccessToken,
  uploadDropboxFile,
} from "../server/api/dropbox.js"
import {
  HttpError,
  readRawBody,
  requireMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../server/api/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const headers = readDocumentUploadHeaders(req)
    const submission = await authorizeSubmissionUpload(req, headers)
    if (submission.file.status === "ready") {
      sendJson(res, 200, { upload: { fileName: submission.file.uploaded_name ?? headers.fileName, sizeBytes: headers.totalSize, submittedAt: submission.submittedAt } })
      return
    }
    const fileBytes = await readRawBody(req)
    if (fileBytes.byteLength !== headers.totalSize) {
      throw new HttpError(400, "Uploaded file size does not match the request metadata.")
    }

    const submittedAt = submission.submittedAt
    const uploadId = submission.submissionId
    const accessToken = await getOwnerAccessToken()
    const folderPath = await getOrCreateDocumentUploadFolder({
      accessToken,
      uploadId,
      fullName: headers.fullName,
      email: headers.email,
      submittedAt,
    })
    const uploadedFile = await uploadDropboxFile({
      accessToken,
      folderPath,
      fileName: headers.fileName,
      fileBytes,
    })

    await recordSubmissionUpload(req, { providerFileId: uploadedFile.id, folderPath, name: uploadedFile.name, sizeBytes: uploadedFile.size ?? headers.totalSize })

    await uploadDropboxFile({
      accessToken,
      folderPath,
      fileName: `submission-details-${submission.fileIndex + 1}.json`,
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
    }).catch(() => console.warn("submission_metadata_backup_failed"))

    sendJson(res, 200, {
      upload: {
        fileName: uploadedFile.name,
        sizeBytes: uploadedFile.size ?? headers.totalSize,
        submittedAt,
      },
    })
  } catch (error) {
    handleDocumentUploadApiError(res, error)
  }
}
