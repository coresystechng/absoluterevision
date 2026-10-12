import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authorizeSubmissionUpload: vi.fn(), recordSubmissionUpload: vi.fn(), saveSubmissionSession: vi.fn(), getOwnerAccessToken: vi.fn(), getOrCreateDocumentUploadFolder: vi.fn(), uploadDropboxFile: vi.fn(), startDropboxUploadSession: vi.fn(), appendDropboxUploadSession: vi.fn(), finishDropboxUploadSession: vi.fn() }))
vi.mock("./client-submissions.js", () => mocks)
vi.mock("./dropbox.js", () => mocks)
import smallUpload from "../../api/document-upload.js"
import chunkedUpload from "../../api/document-upload/upload-session/[action].js"

const submissionId = "b0d8c443-e1bc-49f1-8e68-f0f19c02a862"
const submittedAt = "2026-10-12T10:00:00Z"
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() })
const request = (query = {}) => ({ method: "POST", query, body: Buffer.alloc(100), headers: {
  "x-client-name": "Test%20Client", "x-client-email": "client%40example.com", "x-file-name": "draft.pdf", "x-file-type": "application/pdf", "x-file-size": "100",
  "x-submission-id": submissionId, "x-submission-token": "a".repeat(64), "x-submission-file-index": "0",
} })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.authorizeSubmissionUpload.mockResolvedValue({ submissionId, fileIndex: 0, submittedAt, file: { status: "pending", name: "draft.pdf", size_bytes: 100, session_id: "valid-session" } })
  mocks.getOwnerAccessToken.mockResolvedValue("token")
  mocks.getOrCreateDocumentUploadFolder.mockResolvedValue("/client/submission")
  mocks.uploadDropboxFile.mockResolvedValue({ id: "provider-file", name: "draft.pdf", size: 100 })
  mocks.recordSubmissionUpload.mockResolvedValue(undefined)
  mocks.saveSubmissionSession.mockResolvedValue(undefined)
})

describe("public submission persistence", () => {
  it("records the uploaded file before returning success and groups it under the intake ID", async () => {
    const res = response()
    const req = request()
    await smallUpload(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(mocks.getOrCreateDocumentUploadFolder).toHaveBeenCalledWith(expect.objectContaining({ uploadId: submissionId, submittedAt }))
    expect(mocks.recordSubmissionUpload).toHaveBeenCalledWith(req, { providerFileId: "provider-file", folderPath: "/client/submission", name: "draft.pdf", sizeBytes: 100 })
    expect(res.json).toHaveBeenCalledWith({ upload: { fileName: "draft.pdf", sizeBytes: 100, submittedAt } })
  })

  it("returns a ready file without uploading it again", async () => {
    mocks.authorizeSubmissionUpload.mockResolvedValue({ submissionId, fileIndex: 0, submittedAt, file: { status: "ready", uploaded_name: "draft.pdf" } })
    const res = response()
    await smallUpload(request() as never, res as never)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(mocks.uploadDropboxFile).not.toHaveBeenCalled()
  })

  it("keeps a recorded upload successful when its Dropbox metadata backup fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    mocks.uploadDropboxFile.mockResolvedValueOnce({ id: "provider-file", name: "draft.pdf", size: 100 }).mockRejectedValueOnce(new Error("Backup failed"))
    try {
      const res = response()
      await smallUpload(request() as never, res as never)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(mocks.recordSubmissionUpload).toHaveBeenCalledTimes(1)
      expect(warning).toHaveBeenCalledWith("submission_metadata_backup_failed")
    } finally { warning.mockRestore() }
  })

  it("rejects a forged chunk session before touching Dropbox", async () => {
    const res = response()
    await chunkedUpload(request({ action: "append", sessionId: "someone-elses-session", offset: "0" }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mocks.appendDropboxUploadSession).not.toHaveBeenCalled()
  })

  it("uses the authorized intake identity when completing a chunked upload", async () => {
    mocks.finishDropboxUploadSession.mockResolvedValue({ id: "chunked-file", name: "draft.pdf", size: 100 })
    const res = response()
    const req = { ...request({ action: "finish", sessionId: "valid-session", offset: "50", uploadId: "forged-folder", submittedAt: "1990-01-01" }), body: Buffer.alloc(50) }
    await chunkedUpload(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(mocks.getOrCreateDocumentUploadFolder).toHaveBeenCalledWith(expect.objectContaining({ uploadId: submissionId, submittedAt }))
    expect(mocks.recordSubmissionUpload).toHaveBeenCalledWith(req, expect.objectContaining({ providerFileId: "chunked-file" }))
  })
})
