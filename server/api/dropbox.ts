import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto"

import {
  getAssignmentFolder,
  getOwnerConnection,
  saveAssignmentFolder,
  saveOwnerConnection,
  type AssignmentRow,
  type OwnerConnectionRow,
} from "./db.js"
import { assignmentFileCategoryFolders, type AssignmentFileCategory, slugifyFolderSegment } from "./files.js"
import { HttpError, getRequestOrigin, type ApiRequest } from "./http.js"

const DROPBOX_AUTH_ENDPOINT = "https://www.dropbox.com/oauth2/authorize"
const DROPBOX_TOKEN_ENDPOINT = "https://api.dropboxapi.com/oauth2/token"
const DROPBOX_API_BASE = "https://api.dropboxapi.com/2"
const DROPBOX_CONTENT_BASE = "https://content.dropboxapi.com/2"
const DROPBOX_SCOPES = "files.content.write files.content.read"
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
const REQUIRED_DROPBOX_ENV_VARS = [
  "DROPBOX_OWNER_USER_ID",
  "DROPBOX_CLIENT_ID",
  "DROPBOX_CLIENT_SECRET",
  "DROPBOX_TOKEN_ENCRYPTION_KEY",
] as const

type OAuthState = {
  userId: string
  redirectUri: string
  returnTo: string
  issuedAt: number
}

type DropboxTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type AccessToken = { accessToken: string; expiresAt?: number }
const TOKEN_EXPIRY_MARGIN_MS = 60_000
let connectionFingerprint: string | null = null
let connectionGeneration = 0
let cachedAccessToken: AccessToken | undefined
let pendingRefresh: Promise<AccessToken> | undefined

function invalidateOwnerToken() {
  connectionGeneration += 1
  connectionFingerprint = null
  cachedAccessToken = undefined
  pendingRefresh = undefined
}

function invalidateRejectedToken(response: Response, accessToken: string) {
  if (response.status === 401 && cachedAccessToken?.accessToken === accessToken) {
    invalidateOwnerToken()
  }
}

function fingerprintConnection(connection: OwnerConnectionRow) {
  return createHash("sha256").update(JSON.stringify([
    connection.owner_user_id,
    connection.refresh_token_ciphertext,
    connection.refresh_token_iv,
    connection.refresh_token_tag,
    connection.scopes,
    getClientId(),
    getClientSecret(),
  ])).digest("hex")
}

type DropboxFileMetadata = {
  ".tag": "file"
  id: string
  name: string
  path_display?: string
  size?: number
}

type DropboxTemporaryLink = {
  metadata: DropboxFileMetadata
  link: string
}

type DropboxUploadSessionStart = {
  session_id: string
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new HttpError(503, `${name} is not configured.`)
  }

  return value
}

function getClientId() {
  return getRequiredEnv("DROPBOX_CLIENT_ID")
}

function getClientSecret() {
  return getRequiredEnv("DROPBOX_CLIENT_SECRET")
}

function getTokenEncryptionKey() {
  const secret = getRequiredEnv("DROPBOX_TOKEN_ENCRYPTION_KEY")
  const base64Value = Buffer.from(secret, "base64")

  return base64Value.length === 32 ? base64Value : createHash("sha256").update(secret).digest()
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signStatePayload(encodedPayload: string) {
  return createHmac("sha256", getTokenEncryptionKey()).update(encodedPayload).digest("base64url")
}

function encryptToken(token: string) {
  const key = getTokenEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  }
}

function decryptToken(connection: OwnerConnectionRow) {
  const key = getTokenEncryptionKey()
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(connection.refresh_token_iv, "base64"),
  )
  decipher.setAuthTag(Buffer.from(connection.refresh_token_tag, "base64"))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(connection.refresh_token_ciphertext, "base64")),
    decipher.final(),
  ])

  return plaintext.toString("utf8")
}

function createState(payload: OAuthState) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signStatePayload(encodedPayload)}`
}

function normalizeDropboxPath(path: string) {
  return path
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .replace(/^([^/])/, "/$1")
}

function combineDropboxPath(...segments: string[]) {
  return normalizeDropboxPath(
    segments
      .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/"),
  )
}

function getRequestBody(fileBytes: Buffer) {
  return fileBytes.buffer.slice(
    fileBytes.byteOffset,
    fileBytes.byteOffset + fileBytes.byteLength,
  ) as ArrayBuffer
}

function getRootPath() {
  return normalizeDropboxPath(process.env.DROPBOX_ROOT_PATH || "/Absolute Revision")
}

export function parseOAuthState(state: string) {
  const [encodedPayload, signature] = state.split(".")
  if (!encodedPayload || !signature || signature !== signStatePayload(encodedPayload)) {
    throw new HttpError(400, "Invalid Dropbox authorization state.")
  }

  let payload: OAuthState
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthState
  } catch {
    throw new HttpError(400, "Invalid Dropbox authorization state.")
  }

  if (!payload.userId || !payload.redirectUri || Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS) {
    throw new HttpError(400, "Dropbox authorization state expired.")
  }

  return payload
}

export function isDropboxConfigured() {
  return getDropboxConfigStatus().isConfigured
}

export function getDropboxConfigStatus() {
  const missingKeys = REQUIRED_DROPBOX_ENV_VARS.filter((name) => !process.env[name])

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  }
}

export function createDropboxAuthUrl(req: ApiRequest, input: { userId: string; returnTo: string }) {
  const redirectUri =
    process.env.DROPBOX_REDIRECT_URI ?? `${getRequestOrigin(req)}/api/dropbox/callback`
  const state = createState({
    userId: input.userId,
    redirectUri,
    returnTo: input.returnTo,
    issuedAt: Date.now(),
  })
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline",
    scope: DROPBOX_SCOPES,
    state,
  })

  return `${DROPBOX_AUTH_ENDPOINT}?${params}`
}

async function readDropboxJson<T>(response: Response) {
  const data = (await response.json().catch(() => null)) as T & {
    error?: string | { ".tag"?: string; message?: string }
    error_description?: string
    error_summary?: string
  }

  if (!response.ok) {
    const errorMessage =
      typeof data?.error === "object"
        ? data.error.message ?? data.error[".tag"]
        : data?.error_description ?? data?.error_summary ?? data?.error

    throw new HttpError(response.status, errorMessage || "Dropbox request failed.")
  }

  return data as T
}

export async function exchangeDropboxCode(input: {
  code: string
  redirectUri: string
  ownerUserId: string
}) {
  const response = await fetch(DROPBOX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const tokenResponse = await readDropboxJson<DropboxTokenResponse>(response)
  const refreshToken = tokenResponse.refresh_token
  if (!refreshToken) {
    throw new HttpError(
      400,
      "Dropbox did not return a refresh token. Reconnect Dropbox with offline access enabled.",
    )
  }

  const encrypted = encryptToken(refreshToken)
  await saveOwnerConnection({
    ownerUserId: input.ownerUserId,
    refreshTokenCiphertext: encrypted.ciphertext,
    refreshTokenIv: encrypted.iv,
    refreshTokenTag: encrypted.tag,
    scopes: tokenResponse.scope ?? DROPBOX_SCOPES,
  })
  invalidateOwnerToken()
}

async function refreshAccessToken(refreshToken: string) {
  const requestStartedAt = Date.now()
  const response = await fetch(DROPBOX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const tokenResponse = await readDropboxJson<DropboxTokenResponse>(response)
  if (!tokenResponse.access_token) {
    throw new HttpError(502, "Dropbox did not return an access token.")
  }

  const lifetime = tokenResponse.expires_in
  const expiry = typeof lifetime === "number" && Number.isFinite(lifetime) && lifetime > 0
    ? requestStartedAt + lifetime * 1000
    : undefined
  const expiresAt = expiry !== undefined && Number.isFinite(expiry) ? expiry : undefined
  if (expiresAt !== undefined && expiresAt <= Date.now()) {
    throw new HttpError(502, "Dropbox returned an expired access token.")
  }
  return { accessToken: tokenResponse.access_token, expiresAt }
}

export async function getOwnerAccessToken() {
  let recoveries = 0
  const recover = () => {
    if (recoveries++ >= 1) {
      throw new HttpError(502, "Dropbox connection changed. Please retry the operation.")
    }
  }
  for (;;) {
    const readGeneration = connectionGeneration
    const readFingerprint = connectionFingerprint
    const connection = await getOwnerConnection()
    const fingerprint = connection ? fingerprintConnection(connection) : null
    if (readGeneration !== connectionGeneration) {
      const sameInitialConnection = readFingerprint === null &&
        connectionGeneration === readGeneration + 1 && fingerprint !== null &&
        connectionFingerprint === fingerprint
      if (!sameInitialConnection) {
        recover()
        continue
      }
    }
    if (!connection) {
      invalidateOwnerToken()
      throw new HttpError(409, "Dropbox is not connected.")
    }
    if (connectionFingerprint !== fingerprint) {
      const changedDuringRecovery = connectionFingerprint !== null && recoveries > 0
      invalidateOwnerToken()
      connectionFingerprint = fingerprint
      if (changedDuringRecovery) recover()
    }
    const generation = connectionGeneration
    if (cachedAccessToken?.expiresAt !== undefined &&
        cachedAccessToken.expiresAt - Date.now() > TOKEN_EXPIRY_MARGIN_MS) {
      return cachedAccessToken.accessToken
    }
    if (!pendingRefresh) {
      const promise = refreshAccessToken(decryptToken(connection)).then((token) => {
        if (generation === connectionGeneration && token.expiresAt !== undefined &&
            token.expiresAt - Date.now() > TOKEN_EXPIRY_MARGIN_MS) {
          cachedAccessToken = token
        }
        return token
      }).finally(() => {
        if (generation === connectionGeneration && pendingRefresh === promise) pendingRefresh = undefined
      })
      pendingRefresh = promise
    }
    let token: AccessToken
    try {
      token = await pendingRefresh
    } catch (error) {
      if (generation !== connectionGeneration) {
        recover()
        continue
      }
      throw error
    }
    if (generation !== connectionGeneration) {
      recover()
      continue
    }
    if (token.expiresAt !== undefined && token.expiresAt <= Date.now()) {
      throw new HttpError(502, "Dropbox returned an expired access token.")
    }
    return token.accessToken
  }
}

async function dropboxApiFetch<T>(accessToken: string, path: string, body: unknown) {
  const response = await fetch(`${DROPBOX_API_BASE}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  invalidateRejectedToken(response, accessToken)
  return readDropboxJson<T>(response)
}

async function ensureFolder(accessToken: string, path: string) {
  const response = await fetch(`${DROPBOX_API_BASE}/files/create_folder_v2`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ path, autorename: false }),
  })

  invalidateRejectedToken(response, accessToken)
  if (response.ok) {
    return
  }

  const data = (await response.json().catch(() => null)) as { error_summary?: string } | null
  if (response.status === 409 && data?.error_summary?.includes("path/conflict/folder")) {
    return
  }

  throw new HttpError(response.status, data?.error_summary || "Dropbox folder creation failed.")
}

export async function getOrCreateAssignmentCategoryFolder(input: {
  accessToken: string
  userId: string
  assignment: AssignmentRow
  category: AssignmentFileCategory
}) {
  const storedAssignmentFolderPath = await getAssignmentFolder(input.userId, input.assignment.id)
  const assignmentFolderName = `${input.assignment.id}-${slugifyFolderSegment(input.assignment.title) || "assignment"}`
  const assignmentFolderPath =
    storedAssignmentFolderPath ??
    combineDropboxPath(getRootPath(), "Assignments", assignmentFolderName)
  const categoryFolderPath = combineDropboxPath(
    assignmentFolderPath,
    assignmentFileCategoryFolders[input.category],
  )

  if (!storedAssignmentFolderPath) {
    await ensureFolder(input.accessToken, getRootPath())
    await ensureFolder(input.accessToken, combineDropboxPath(getRootPath(), "Assignments"))
    await ensureFolder(input.accessToken, assignmentFolderPath)
    await saveAssignmentFolder(input.userId, input.assignment.id, assignmentFolderPath)
  }

  await ensureFolder(input.accessToken, categoryFolderPath)
  return categoryFolderPath
}

export async function getOrCreateDocumentUploadFolder(input: {
  accessToken: string
  uploadId: string
  fullName: string
  email: string
  submittedAt: string
}) {
  const uploadFolderPath = getDocumentUploadFolderPath(input)
  const uploadsRootPath = combineDropboxPath(getRootPath(), "Document Uploads")
  const dateFolderPath = combineDropboxPath(uploadsRootPath, input.submittedAt.slice(0, 10))

  await ensureFolder(input.accessToken, getRootPath())
  await ensureFolder(input.accessToken, uploadsRootPath)
  await ensureFolder(input.accessToken, dateFolderPath)
  await ensureFolder(input.accessToken, uploadFolderPath)

  return uploadFolderPath
}

export async function uploadDropboxFile(input: {
  accessToken: string
  folderPath: string
  fileName: string
  fileBytes: Buffer
}) {
  const uploadPath = combineDropboxPath(input.folderPath, input.fileName)
  const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/octet-stream",
      "dropbox-api-arg": JSON.stringify({
        path: uploadPath,
        mode: "add",
        autorename: true,
        mute: false,
        strict_conflict: false,
      }),
    },
    body: getRequestBody(input.fileBytes),
  })

  invalidateRejectedToken(response, input.accessToken)
  return readDropboxJson<DropboxFileMetadata>(response)
}

export async function startDropboxUploadSession(accessToken: string, fileBytes: Buffer) {
  const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload_session/start`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/octet-stream",
      "dropbox-api-arg": JSON.stringify({ close: false }),
    },
    body: getRequestBody(fileBytes),
  })

  invalidateRejectedToken(response, accessToken)
  return readDropboxJson<DropboxUploadSessionStart>(response)
}

export async function appendDropboxUploadSession(input: {
  accessToken: string
  sessionId: string
  offset: number
  fileBytes: Buffer
}) {
  const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload_session/append_v2`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/octet-stream",
      "dropbox-api-arg": JSON.stringify({
        cursor: {
          session_id: input.sessionId,
          offset: input.offset,
        },
        close: false,
      }),
    },
    body: getRequestBody(input.fileBytes),
  })

  invalidateRejectedToken(response, input.accessToken)
  await readDropboxJson<Record<string, never>>(response)
}

export async function finishDropboxUploadSession(input: {
  accessToken: string
  sessionId: string
  offset: number
  folderPath: string
  fileName: string
  fileBytes: Buffer
}) {
  const uploadPath = combineDropboxPath(input.folderPath, input.fileName)
  const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload_session/finish`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/octet-stream",
      "dropbox-api-arg": JSON.stringify({
        cursor: {
          session_id: input.sessionId,
          offset: input.offset,
        },
        commit: {
          path: uploadPath,
          mode: "add",
          autorename: true,
          mute: false,
          strict_conflict: false,
        },
      }),
    },
    body: getRequestBody(input.fileBytes),
  })

  invalidateRejectedToken(response, input.accessToken)
  return readDropboxJson<DropboxFileMetadata>(response)
}

export async function deleteDropboxFile(accessToken: string, fileId: string) {
  await dropboxApiFetch(accessToken, "/files/delete_v2", { path: fileId })
}

export async function getDropboxTemporaryLink(accessToken: string, fileId: string) {
  const result = await dropboxApiFetch<DropboxTemporaryLink>(
    accessToken,
    "/files/get_temporary_link",
    { path: fileId },
  )
  return result.link
}


export function getDocumentUploadFolderPath(input: { uploadId: string; fullName: string; email: string; submittedAt: string }) {
  const submittedDate = input.submittedAt.slice(0, 10)
  const emailName = input.email.split("@")[0] ?? ""
  const submitterSegment =
    slugifyFolderSegment(`${input.fullName}-${emailName}`) || "client"
  const uploadsRootPath = combineDropboxPath(getRootPath(), "Document Uploads")
  const dateFolderPath = combineDropboxPath(uploadsRootPath, submittedDate)
  return combineDropboxPath(
    dateFolderPath,
    `${input.uploadId}-${submitterSegment}`,
  )

}

export async function deleteDocumentUploadFolder(accessToken: string, folderPath: string) {
  try {
    await deleteDropboxFile(accessToken, folderPath)
  } catch (error) {
    // A prior cleanup may have deleted the folder before its database commit.
    if (error instanceof HttpError && error.statusCode === 409 && /^path_lookup\/not_found(?:\/|$)/.test(error.message)) return
    throw error
  }
}
