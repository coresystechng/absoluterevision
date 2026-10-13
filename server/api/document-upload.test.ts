import { describe, expect, it } from "vitest"
import { documentUploadExtensions } from "../../shared/document-uploads.js"
import { readDocumentUploadHeaders } from "./document-upload.js"
import type { ApiRequest } from "./http.js"

function request(fileName: string, size = "100") {
  return { headers: {
    "x-client-name": "Test%20Client",
    "x-client-email": "client%40example.com",
    "x-file-name": encodeURIComponent(fileName),
    "x-file-size": size,
  } } as unknown as ApiRequest
}

describe("public upload validation", () => {
  it.each(documentUploadExtensions)("accepts .%s files on the server", (extension) => {
    expect(readDocumentUploadHeaders(request(`file.${extension.toUpperCase()}`)).fileName).toBe(`file.${extension.toUpperCase()}`)
  })

  it.each(["file.html", "file.svg", "file.exe", "image.png.exe", "no-extension"])("rejects unsupported file %s", (name) => {
    expect(() => readDocumentUploadHeaders(request(name))).toThrow("supported image")
  })

  it.each(["0", "-1", "1.5", "NaN", String(25 * 1024 * 1024 + 1)])("rejects invalid size %s", (size) => {
    expect(() => readDocumentUploadHeaders(request("image.png", size))).toThrow("25 MB")
  })

  it("accepts the maximum file size", () => {
    expect(readDocumentUploadHeaders(request("image.png", String(25 * 1024 * 1024))).totalSize).toBe(25 * 1024 * 1024)
  })
})
