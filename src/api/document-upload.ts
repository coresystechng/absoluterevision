import {
  getDocumentUploadFileError,
  getDocumentUploadSelectionError,
} from "../../shared/document-uploads"

export type DocumentUploadResult = {
  fileName: string
  sizeBytes: number
  submittedAt: string
}

type DocumentUploadInput = {
  fullName: string
  email: string
  file: File
  onProgress?: (progress: number) => void
}

const uploadChunkBytes = 3 * 1024 * 1024

function encodeHeader(value: string) {
  return encodeURIComponent(value.trim())
}

function documentUploadHeaders(input: DocumentUploadInput) {
  return {
    "content-type": "application/octet-stream",
    "x-client-name": encodeHeader(input.fullName),
    "x-client-email": encodeHeader(input.email),
    "x-file-name": encodeHeader(input.file.name),
    "x-file-type": input.file.type || "application/octet-stream",
    "x-file-size": String(input.file.size),
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data ? data.error : null

    throw new Error(
      errorMessage
        ? String(errorMessage)
        : "The upload could not be completed.",
    )
  }

  return data as T
}

function reportProgress(input: DocumentUploadInput, uploadedBytes: number) {
  input.onProgress?.(Math.min(100, Math.round((uploadedBytes / input.file.size) * 100)))
}

export async function submitDocumentUpload(input: DocumentUploadInput) {
  const error = getDocumentUploadFileError(input.file)
  if (error) throw new Error(error)

  if (input.file.size <= uploadChunkBytes) {
    return uploadSmallDocument(input)
  }

  return uploadChunkedDocument(input)
}

export type DocumentUploadFailure = { file: File; message: string }

export async function submitDocumentUploads(input: {
  fullName: string
  email: string
  files: File[]
  onProgress?: (progress: number) => void
}) {
  const error = getDocumentUploadSelectionError(input.files)
  if (error) throw new Error(error)

  const totalBytes = input.files.reduce((total, file) => total + file.size, 0)
  const fileProgress = input.files.map(() => 0)
  input.onProgress?.(0)
  const outcomes = await Promise.all(input.files.map(async (file, index) => {
    try {
      const upload = await submitDocumentUpload({
        fullName: input.fullName,
        email: input.email,
        file,
        onProgress: (progress) => {
          fileProgress[index] = progress
          const uploadedBytes = input.files.reduce(
            (total, item, itemIndex) => total + item.size * fileProgress[itemIndex] / 100,
            0,
          )
          input.onProgress?.(Math.round(uploadedBytes / totalBytes * 100))
        },
      })
      return { upload, failure: null }
    } catch (error) {
      return {
        upload: null,
        failure: { file, message: error instanceof Error ? error.message : "Upload failed." },
      }
    }
  }))

  return {
    uploads: outcomes.flatMap(({ upload }) => upload ? [upload] : []),
    failures: outcomes.flatMap(({ failure }) => failure ? [failure] : []),
  }
}

async function uploadSmallDocument(input: DocumentUploadInput) {
  input.onProgress?.(8)
  const response = await fetch("/api/document-upload", {
    method: "POST",
    headers: documentUploadHeaders(input),
    body: input.file,
  })
  const result = await readApiResponse<{ upload: DocumentUploadResult }>(response)
  input.onProgress?.(100)
  return result.upload
}

async function uploadChunkedDocument(input: DocumentUploadInput) {
  const firstChunk = input.file.slice(0, uploadChunkBytes)
  const startResponse = await fetch("/api/document-upload/upload-session/start", {
    method: "POST",
    headers: documentUploadHeaders(input),
    body: firstChunk,
  })
  const session = await readApiResponse<{
    sessionId: string
    offset: number
    uploadId: string
    submittedAt: string
  }>(startResponse)
  let offset = session.offset
  reportProgress(input, offset)

  while (offset + uploadChunkBytes < input.file.size) {
    const appendChunk = input.file.slice(offset, offset + uploadChunkBytes)
    const appendParams = new URLSearchParams({
      sessionId: session.sessionId,
      offset: String(offset),
    })
    const appendResponse = await fetch(
      `/api/document-upload/upload-session/append?${appendParams}`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: appendChunk,
      },
    )
    const result = await readApiResponse<{ offset: number }>(appendResponse)
    offset = result.offset
    reportProgress(input, offset)
  }

  const finalChunk = input.file.slice(offset)
  const finishParams = new URLSearchParams({
    sessionId: session.sessionId,
    offset: String(offset),
    uploadId: session.uploadId,
    submittedAt: session.submittedAt,
  })
  const finishResponse = await fetch(
    `/api/document-upload/upload-session/finish?${finishParams}`,
    {
      method: "POST",
      headers: documentUploadHeaders(input),
      body: finalChunk,
    },
  )
  const result = await readApiResponse<{ upload: DocumentUploadResult }>(finishResponse)
  input.onProgress?.(100)
  return result.upload
}
