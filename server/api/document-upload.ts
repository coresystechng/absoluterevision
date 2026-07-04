import { randomBytes } from "node:crypto"

import { normalizeEncodedFileName } from "./files.js"
import {
  HttpError,
  getHeader,
  handleApiError,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "./http.js"

export const DOCUMENT_UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024
export const DOCUMENT_UPLOAD_MAX_BYTES = 250 * 1024 * 1024

const allowedDocumentExtensions = new Set([
  "csv",
  "doc",
  "docx",
  "odt",
  "pages",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
])

export type DocumentUploadHeaders = {
  fullName: string
  email: string
  fileName: string
  mimeType: string
  totalSize: number
}

function decodeHeaderValue(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeFullName(value: unknown) {
  const fullName = decodeHeaderValue(value).replace(/\s+/g, " ").trim()
  if (fullName.length < 2 || fullName.length > 120) {
    throw new HttpError(400, "Full Name must be between 2 and 120 characters.")
  }

  return fullName
}

function normalizeEmail(value: unknown) {
  const email = decodeHeaderValue(value).trim().toLowerCase()
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new HttpError(400, "Enter a valid Email Address.")
  }

  return email
}

function getFileExtension(fileName: string) {
  const extensionStart = fileName.lastIndexOf(".")
  if (extensionStart <= 0 || extensionStart === fileName.length - 1) {
    return ""
  }

  return fileName.slice(extensionStart + 1).toLowerCase()
}

function normalizeDocumentFileName(value: unknown) {
  const fileName = normalizeEncodedFileName(value)
  const extension = getFileExtension(fileName)
  if (!fileName) {
    throw new HttpError(400, "Choose a document to upload.")
  }
  if (!allowedDocumentExtensions.has(extension)) {
    throw new HttpError(
      400,
      "Upload a Word, PDF, RTF, OpenDocument, text, presentation, or spreadsheet file.",
    )
  }

  return fileName
}

function normalizeTotalSize(value: unknown) {
  const totalSize = Number(value)
  if (
    !Number.isFinite(totalSize) ||
    totalSize <= 0 ||
    totalSize > DOCUMENT_UPLOAD_MAX_BYTES
  ) {
    throw new HttpError(400, "Files must be between 1 byte and 250 MB.")
  }

  return totalSize
}

export function readDocumentUploadHeaders(req: ApiRequest): DocumentUploadHeaders {
  return {
    fullName: normalizeFullName(getHeader(req.headers, "x-client-name")),
    email: normalizeEmail(getHeader(req.headers, "x-client-email")),
    fileName: normalizeDocumentFileName(getHeader(req.headers, "x-file-name")),
    mimeType:
      getHeader(req.headers, "x-file-type")?.trim() || "application/octet-stream",
    totalSize: normalizeTotalSize(getHeader(req.headers, "x-file-size")),
  }
}

export function createDocumentUploadId(submittedAt: string) {
  const timestamp = Date.parse(submittedAt).toString(36)
  return `${timestamp}-${randomBytes(4).toString("hex")}`
}

export function normalizeDocumentUploadId(value: unknown) {
  const uploadId = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!/^[a-z0-9-]{8,80}$/.test(uploadId)) {
    throw new HttpError(400, "A valid document upload ID is required.")
  }

  return uploadId
}

export function normalizeSubmittedAt(value: unknown) {
  const submittedAt = typeof value === "string" ? value.trim() : ""
  const timestamp = Date.parse(submittedAt)
  if (!submittedAt || !Number.isFinite(timestamp)) {
    throw new HttpError(400, "A valid submission timestamp is required.")
  }

  return new Date(timestamp).toISOString()
}

export function validateUploadChunkSize(sizeBytes: number) {
  if (sizeBytes <= 0 || sizeBytes > DOCUMENT_UPLOAD_CHUNK_BYTES) {
    throw new HttpError(400, "Upload chunks must be between 1 byte and 3 MB.")
  }
}

export function createDocumentUploadMetadataFile(input: {
  fullName: string
  email: string
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadId: string
  submittedAt: string
  providerFileId: string
}) {
  return Buffer.from(
    JSON.stringify(
      {
        fullName: input.fullName,
        email: input.email,
        originalFileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadId: input.uploadId,
        submittedAt: input.submittedAt,
        provider: "dropbox",
        providerFileId: input.providerFileId,
      },
      null,
      2,
    ),
    "utf8",
  )
}

export function handleDocumentUploadApiError(res: ApiResponse, error: unknown) {
  if (error instanceof HttpError && (error.statusCode === 409 || error.statusCode === 503)) {
    sendJson(res, error.statusCode, {
      error: "Document uploads are temporarily unavailable. Please contact support.",
    })
    return
  }

  handleApiError(res, error)
}
