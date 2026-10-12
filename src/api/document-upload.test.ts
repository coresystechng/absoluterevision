import { afterEach, describe, expect, it, vi } from "vitest"
import { submitDocumentUploads } from "./document-upload"

afterEach(() => vi.unstubAllGlobals())

const file = (name: string) => new File(["content"], name)
const client = { fullName: "Test Client", email: "client@example.com" }
const intake = { submissionId: "b0d8c443-e1bc-49f1-8e68-f0f19c02a862", token: "a".repeat(64) }
const intakeResponse = { ok: true, json: async () => intake }
const finalizedResponse = { ok: true, json: async () => ({ finalized: true }) }
const response = (fileName: string) => ({
  ok: true,
  json: async () => ({ upload: { fileName, sizeBytes: 7, submittedAt: "2026-10-12T10:00:00Z" } }),
})

describe("client file uploads", () => {
  it("rejects invalid batches before any files are sent", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    for (const files of [[], Array.from({ length: 4 }, () => file("draft.pdf")), [file("script.html")], [new File([], "empty.png")]]) {
      await expect(submitDocumentUploads({ ...client, files })).rejects.toThrow()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uploads three mixed files concurrently and reports combined progress", async () => {
    const files = [file("draft.pdf"), file("figure.JPG"), file("photo.heic")]
    const fetchMock = vi.fn().mockImplementation(async (url, options) => url === "/api/client-submissions/intake" ? intakeResponse : response(options.body.name))
    vi.stubGlobal("fetch", fetchMock)
    const onProgress = vi.fn()
    const result = await submitDocumentUploads({ ...client, files, onProgress })
    expect(result.uploads.map((upload) => upload.fileName)).toEqual(files.map((item) => item.name))
    expect(result.failures).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(onProgress).toHaveBeenLastCalledWith(100)
    expect(fetchMock.mock.calls[1][1].headers["x-client-email"]).toBe("client%40example.com")
    for (const [index, call] of fetchMock.mock.calls.slice(1, 4).entries()) {
      expect(call[1].headers["x-submission-id"]).toBe(intake.submissionId)
      expect(call[1].headers["x-submission-file-index"]).toBe(String(index))
    }
  })

  it("keeps successful results when another file fails", async () => {
    const files = [file("draft.pdf"), file("figure.png"), file("notes.txt")]
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(intakeResponse)
      .mockResolvedValueOnce(response("draft.pdf"))
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(response("notes.txt"))
      .mockResolvedValueOnce(finalizedResponse))
    const result = await submitDocumentUploads({ ...client, files })
    expect(result.uploads.map((upload) => upload.fileName)).toEqual(["draft.pdf", "notes.txt"])
    expect(result.failures).toEqual([{ file: files[1], message: "Connection lost", uploadAccess: { ...intake, fileIndex: 1 } }])
  })

  it("preserves chunked uploads for large images", async () => {
    const image = new File([new Uint8Array(7 * 1024 * 1024)], "large.png", { type: "image/png" })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(intakeResponse)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: "session", offset: 3 * 1024 * 1024, uploadId: "upload-id", submittedAt: "2026-10-12T10:00:00Z" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ offset: 6 * 1024 * 1024 }) })
      .mockResolvedValueOnce(response(image.name))
      .mockResolvedValueOnce(finalizedResponse)
    vi.stubGlobal("fetch", fetchMock)
    const result = await submitDocumentUploads({ ...client, files: [image] })
    expect(result.failures).toEqual([])
    expect(fetchMock.mock.calls.slice(1, 4).map(([url]) => url.split("?")[0])).toEqual([
      "/api/document-upload/upload-session/start",
      "/api/document-upload/upload-session/append",
      "/api/document-upload/upload-session/finish",
    ])
    expect(fetchMock.mock.calls[3][1].body.size).toBe(1024 * 1024)
    expect(fetchMock.mock.calls[2][1].headers["x-submission-token"]).toBe(intake.token)
  })

  it("reuses the submission and file slot when retrying a failed file", async () => {
    const image = file("photo.png")
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(finalizedResponse)
      .mockResolvedValueOnce(response(image.name))
      .mockResolvedValueOnce(finalizedResponse)
    vi.stubGlobal("fetch", fetchMock)
    await submitDocumentUploads({ ...client, files: [image], retryFailures: [{ file: image, message: "Connection lost", uploadAccess: { ...intake, fileIndex: 2 } }] })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: "retry", ...intake })
    expect(fetchMock.mock.calls[1][1].headers["x-submission-file-index"]).toBe("2")
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/document-upload")).toHaveLength(1)
  })

  it("returns saved uploads even if finalization fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(intakeResponse).mockResolvedValueOnce(response("draft.pdf")).mockRejectedValueOnce(new Error("Network error")))
    const result = await submitDocumentUploads({ ...client, files: [file("draft.pdf")] })
    expect(result.uploads).toHaveLength(1)
    expect(result.finalizationError).toContain("saved")
  })
})
