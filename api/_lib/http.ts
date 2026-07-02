import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http"

export type ApiRequest = IncomingMessage & {
  body?: unknown
  query?: Record<string, string | string[]>
}

export type ApiResponse = ServerResponse & {
  status: (statusCode: number) => ApiResponse
  json: (body: unknown) => void
}

export class HttpError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export function sendJson(res: ApiResponse, statusCode: number, body: unknown) {
  res.status(statusCode).json(body)
}

export function handleApiError(res: ApiResponse, error: unknown) {
  if (error instanceof HttpError) {
    sendJson(res, error.statusCode, { error: error.message })
    return
  }

  console.error(error)
  sendJson(res, 500, { error: "Something went wrong. Try again." })
}

export function requireMethod(req: ApiRequest, method: string) {
  if (req.method !== method) {
    throw new HttpError(405, `Use ${method} for this endpoint.`)
  }
}

export function getHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

export function getRequestOrigin(req: ApiRequest) {
  const host = getHeader(req.headers, "host") ?? "localhost"
  const protocol = getHeader(req.headers, "x-forwarded-proto") ?? "http"
  return `${protocol}://${host}`
}

export function getQueryParam(req: ApiRequest, name: string) {
  const queryValue = req.query?.[name]
  if (Array.isArray(queryValue)) {
    return queryValue[0]
  }

  if (queryValue) {
    return queryValue
  }

  if (!req.url) {
    return null
  }

  const url = new URL(req.url, getRequestOrigin(req))
  return url.searchParams.get(name)
}

export async function readJsonBody<T extends Record<string, unknown>>(req: ApiRequest) {
  if (req.body && typeof req.body === "object") {
    return req.body as T
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString("utf8")
  if (!rawBody.trim()) {
    return {} as T
  }

  try {
    return JSON.parse(rawBody) as T
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.")
  }
}

export async function readRawBody(req: ApiRequest) {
  if (Buffer.isBuffer(req.body)) {
    return req.body
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body)
  }

  if (req.body instanceof ArrayBuffer) {
    return Buffer.from(req.body)
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

export function requireOwner(req: ApiRequest) {
  const ownerUserId = process.env.DROPBOX_OWNER_USER_ID
  if (!ownerUserId) {
    throw new HttpError(503, "Dropbox owner is not configured.")
  }

  const userId = getHeader(req.headers, "x-absolute-revision-user-id")
  if (!userId || userId !== ownerUserId) {
    throw new HttpError(403, "Only the configured owner can manage Dropbox files.")
  }

  return userId
}

export function getActorName(req: ApiRequest) {
  return getHeader(req.headers, "x-absolute-revision-actor-name")?.trim() || "Owner"
}
