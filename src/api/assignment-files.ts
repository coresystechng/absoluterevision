import type { AssignmentFile, AssignmentFileCategory } from "@/types"

type DropboxStatus = {
  isConfigured: boolean
  isConnected: boolean
  missingKeys?: string[]
}

const uploadChunkBytes = 3 * 1024 * 1024

function authHeaders(userId: string, actorName?: string) {
  return {
    "x-absolute-revision-user-id": userId,
    ...(actorName ? { "x-absolute-revision-actor-name": actorName } : {}),
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
        : "The request could not be completed.",
    )
  }

  return data as T
}

export async function getDropboxStatus(userId: string) {
  const response = await fetch("/api/dropbox/status", {
    headers: authHeaders(userId),
  })
  return readApiResponse<DropboxStatus>(response)
}

export async function getDropboxAuthUrl(userId: string, returnTo: string) {
  const response = await fetch("/api/dropbox/auth-url", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(userId),
    },
    body: JSON.stringify({ returnTo }),
  })
  return readApiResponse<{ url: string }>(response)
}

export async function getAssignmentFiles(userId: string, assignmentId: number) {
  const params = new URLSearchParams({ assignmentId: String(assignmentId) })
  const response = await fetch(`/api/assignment-files?${params}`, {
    headers: authHeaders(userId),
  })
  const data = await readApiResponse<{ files: AssignmentFile[] }>(response)
  return data.files
}

export async function uploadAssignmentFile(
  userId: string,
  input: {
    assignmentId: number
    actorName: string
    file: File
    category: AssignmentFileCategory
  },
) {
  if (input.file.size <= uploadChunkBytes) {
    return uploadSmallAssignmentFile(userId, input)
  }

  return uploadChunkedAssignmentFile(userId, input)
}

async function uploadSmallAssignmentFile(
  userId: string,
  input: {
    assignmentId: number
    actorName: string
    file: File
    category: AssignmentFileCategory
  },
) {
  const params = new URLSearchParams({
    assignmentId: String(input.assignmentId),
    category: input.category,
  })
  const response = await fetch(`/api/assignment-files/upload?${params}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(input.file.name),
      "x-file-type": input.file.type || "application/octet-stream",
      "x-file-size": String(input.file.size),
      ...authHeaders(userId, input.actorName),
    },
    body: input.file,
  })
  const result = await readApiResponse<{ file: AssignmentFile }>(response)
  return result.file
}

async function uploadChunkedAssignmentFile(
  userId: string,
  input: {
    assignmentId: number
    actorName: string
    file: File
    category: AssignmentFileCategory
  },
) {
  const firstChunk = input.file.slice(0, uploadChunkBytes)
  const startParams = new URLSearchParams({
    assignmentId: String(input.assignmentId),
    category: input.category,
  })
  const startResponse = await fetch(`/api/assignment-files/upload-session/start?${startParams}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(input.file.name),
      "x-file-size": String(input.file.size),
      ...authHeaders(userId, input.actorName),
    },
    body: firstChunk,
  })
  const session = await readApiResponse<{ sessionId: string; offset: number }>(startResponse)
  let offset = session.offset

  while (offset + uploadChunkBytes < input.file.size) {
    const appendChunk = input.file.slice(offset, offset + uploadChunkBytes)
    const appendParams = new URLSearchParams({
      sessionId: session.sessionId,
      offset: String(offset),
    })
    const appendResponse = await fetch(`/api/assignment-files/upload-session/append?${appendParams}`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        ...authHeaders(userId, input.actorName),
      },
      body: appendChunk,
    })
    const result = await readApiResponse<{ offset: number }>(appendResponse)
    offset = result.offset
  }

  const finalChunk = input.file.slice(offset)
  const finishParams = new URLSearchParams({
    assignmentId: String(input.assignmentId),
    category: input.category,
    sessionId: session.sessionId,
    offset: String(offset),
  })
  const finishResponse = await fetch(`/api/assignment-files/upload-session/finish?${finishParams}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(input.file.name),
      "x-file-type": input.file.type || "application/octet-stream",
      "x-file-size": String(input.file.size),
      ...authHeaders(userId, input.actorName),
    },
    body: finalChunk,
  })
  const result = await readApiResponse<{ file: AssignmentFile }>(finishResponse)
  return result.file
}

export async function getAssignmentFileDownloadUrl(userId: string, fileId: number) {
  const params = new URLSearchParams({ fileId: String(fileId) })
  const response = await fetch(`/api/assignment-files/download?${params}`, {
    headers: authHeaders(userId),
  })
  return readApiResponse<{ url: string }>(response)
}

export async function removeAssignmentFile(
  userId: string,
  actorName: string,
  fileId: number,
) {
  const params = new URLSearchParams({ fileId: String(fileId) })
  const response = await fetch(`/api/assignment-files?${params}`, {
    method: "DELETE",
    headers: authHeaders(userId, actorName),
  })
  await readApiResponse<{ ok: true }>(response)
}
