import { afterEach, describe, expect, it, vi } from "vitest"
import { submitDocumentUploads } from "./document-upload"

afterEach(() => vi.unstubAllGlobals())

const file = (name: string) => new File(["content"], name)
const client = { fullName: "Test Client", email: "client@example.com" }
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
    const fetchMock = vi.fn().mockImplementation(async (_url, options) => response(options.body.name))
    vi.stubGlobal("fetch", fetchMock)
    const onProgress = vi.fn()
    const result = await submitDocumentUploads({ ...client, files, onProgress })
    expect(result.uploads.map((upload) => upload.fileName)).toEqual(files.map((item) => item.name))
    expect(result.failures).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith(100)
    expect(fetchMock.mock.calls[1][1].headers["x-client-email"]).toBe("client%40example.com")
  })

  it("keeps successful results when another file fails", async () => {
    const files = [file("draft.pdf"), file("figure.png"), file("notes.txt")]
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response("draft.pdf"))
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(response("notes.txt")))
    const result = await submitDocumentUploads({ ...client, files })
    expect(result.uploads.map((upload) => upload.fileName)).toEqual(["draft.pdf", "notes.txt"])
    expect(result.failures).toEqual([{ file: files[1], message: "Connection lost" }])
  })

  it("preserves chunked uploads for large images", async () => {
    const image = new File([new Uint8Array(7 * 1024 * 1024)], "large.png", { type: "image/png" })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: "session", offset: 3 * 1024 * 1024, uploadId: "upload-id", submittedAt: "2026-10-12T10:00:00Z" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ offset: 6 * 1024 * 1024 }) })
      .mockResolvedValueOnce(response(image.name))
    vi.stubGlobal("fetch", fetchMock)
    const result = await submitDocumentUploads({ ...client, files: [image] })
    expect(result.failures).toEqual([])
    expect(fetchMock.mock.calls.map(([url]) => url.split("?")[0])).toEqual([
      "/api/document-upload/upload-session/start",
      "/api/document-upload/upload-session/append",
      "/api/document-upload/upload-session/finish",
    ])
    expect(fetchMock.mock.calls[2][1].body.size).toBe(1024 * 1024)
  })
})
