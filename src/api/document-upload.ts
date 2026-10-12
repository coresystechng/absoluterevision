import {
  getDocumentUploadFileError,
  getDocumentUploadSelectionError,
} from "../../shared/document-uploads"
import type { SubmissionUploadAccess } from "../../shared/client-submissions"

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
  uploadAccess?: SubmissionUploadAccess
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
    ...submissionUploadHeaders(input.uploadAccess),
  }
}

function submissionUploadHeaders(access?: SubmissionUploadAccess): Record<string, string> {
  return access ? {
    "x-submission-id": access.submissionId,
    "x-submission-token": access.token,
    "x-submission-file-index": String(access.fileIndex),
  } : {}
}

async function intakeRequest<T>(body: Record<string, unknown>) {
  return readApiResponse<T>(await fetch("/api/client-submissions/intake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))
}

async function createIntake(fullName: string, email: string, files: File[]) {
  return intakeRequest<{ submissionId: string; token: string }>({
    action: "create", fullName, email,
    files: files.map((file) => ({ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" })),
  })
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

export async function submitDocumentUpload(input: DocumentUploadInput): Promise<DocumentUploadResult> {
  const error = getDocumentUploadFileError(input.file)
  if (error) throw new Error(error)

  if (!input.uploadAccess) {
    const result = await submitDocumentUploads({ fullName: input.fullName, email: input.email, files: [input.file], onProgress: input.onProgress })
    if (!result.uploads[0]) throw new Error(result.failures[0]?.message ?? "Upload failed.")
    return result.uploads[0]
  }

  if (input.file.size <= uploadChunkBytes) {
    return uploadSmallDocument(input)
  }

  return uploadChunkedDocument(input)
}

export type DocumentUploadFailure = { file: File; message: string; uploadAccess?: SubmissionUploadAccess }

export async function submitDocumentUploads(input: {
  fullName: string
  email: string
  files: File[]
  onProgress?: (progress: number) => void
  retryFailures?: DocumentUploadFailure[]
}): Promise<{ uploads: DocumentUploadResult[]; failures: DocumentUploadFailure[]; finalizationError?: string }> {
  const error = getDocumentUploadSelectionError(input.files)
  if (error) throw new Error(error)

  const retryAccess = input.files.map((file) => input.retryFailures?.find((failure) => failure.file === file)?.uploadAccess)
  let accesses: SubmissionUploadAccess[]
  if (retryAccess.every((access) => Boolean(access))) {
    accesses = retryAccess as SubmissionUploadAccess[]
    await intakeRequest({ action: "retry", submissionId: accesses[0].submissionId, token: accesses[0].token })
  } else {
    const intake = await createIntake(input.fullName, input.email, input.files)
    accesses = input.files.map((_, fileIndex) => ({ ...intake, fileIndex }))
  }

  const totalBytes = input.files.reduce((total, file) => total + file.size, 0)
  const fileProgress = input.files.map(() => 0)
  input.onProgress?.(0)
  const outcomes = await Promise.all(input.files.map(async (file, index) => {
    try {
      const upload = await submitDocumentUpload({
        fullName: input.fullName,
        email: input.email,
        file,
        uploadAccess: accesses[index],
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
        failure: { file, message: error instanceof Error ? error.message : "Upload failed.", uploadAccess: accesses[index] },
      }
    }
  }))

  let finalizationError: string | undefined
  try {
    await intakeRequest({ action: "finalize", submissionId: accesses[0].submissionId, token: accesses[0].token })
  } catch {
    finalizationError = "Your uploaded files were saved, but submission processing is delayed. Please contact support if a file failed to upload."
  }
  return {
    uploads: outcomes.flatMap(({ upload }) => upload ? [upload] : []),
    failures: outcomes.flatMap(({ failure }) => failure ? [failure] : []),
    finalizationError,
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
  const startResult = await readApiResponse<{ upload: DocumentUploadResult } | {
    sessionId: string
    offset: number
    uploadId: string
    submittedAt: string
  }>(startResponse)
  if ("upload" in startResult) {
    input.onProgress?.(100)
    return startResult.upload
  }
  const session = startResult
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
        headers: { "content-type": "application/octet-stream", ...submissionUploadHeaders(input.uploadAccess) },
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
