import { getOwnerConnection, isFilesDatabaseConfigured } from "../../server/api/db.js"
import {
  createDropboxAuthUrl,
  exchangeDropboxCode,
  getDropboxConfigStatus,
  parseOAuthState,
} from "../../server/api/dropbox.js"
import {
  HttpError,
  getQueryParam,
  getRequestOrigin,
  handleApiError,
  readJsonBody,
  requireMethod,
  requireOwner,
  requireUser,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../../server/api/http.js"

type DropboxAction = "auth-url" | "callback" | "status"

function redirect(res: ApiResponse, url: string) {
  res.statusCode = 302
  res.setHeader("location", url)
  res.end()
}

function getActionParam(req: ApiRequest) {
  const queryValue = req.query?.action
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
  const match = url.pathname.match(/^\/api\/dropbox\/([^/]+)\/?$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function getDropboxAction(req: ApiRequest): DropboxAction {
  const action = getActionParam(req)

  if (action === "auth-url" || action === "callback" || action === "status") {
    return action
  }

  throw new HttpError(404, "Dropbox endpoint not found.")
}

async function handleAuthUrl(req: ApiRequest, res: ApiResponse) {
  requireMethod(req, "POST")
  const userId = requireOwner(req)
  const body = await readJsonBody<{ returnTo?: unknown }>(req)
  const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/")
    ? body.returnTo
    : "/dashboard"

  sendJson(res, 200, {
    url: createDropboxAuthUrl(req, { userId, returnTo }),
  })
}

async function handleCallback(req: ApiRequest, res: ApiResponse) {
  requireMethod(req, "GET")

  const code = getQueryParam(req, "code")
  const state = getQueryParam(req, "state")
  const error = getQueryParam(req, "error")
  const origin = getRequestOrigin(req)

  if (error) {
    redirect(res, `${origin}/settings?dropbox=error`)
    return
  }

  if (!code || !state) {
    throw new HttpError(400, "Missing Dropbox authorization code.")
  }

  const payload = parseOAuthState(state)
  const ownerUserId = process.env.DROPBOX_OWNER_USER_ID
  if (!ownerUserId || payload.userId !== ownerUserId) {
    throw new HttpError(403, "Dropbox can only be connected by the configured owner.")
  }

  await exchangeDropboxCode({
    code,
    redirectUri: payload.redirectUri,
    ownerUserId,
  })

  redirect(res, `${origin}${payload.returnTo}?dropbox=connected`)
}

async function handleStatus(req: ApiRequest, res: ApiResponse) {
  requireMethod(req, "GET")
  requireUser(req)

  const dropboxConfig = getDropboxConfigStatus()
  const missingKeys: string[] = [...dropboxConfig.missingKeys]

  if (!isFilesDatabaseConfigured()) {
    missingKeys.push("NEON_DATABASE_URL")
  }

  if (!process.env.DROPBOX_OWNER_USER_ID) {
    sendJson(res, 200, {
      isConfigured: false,
      isConnected: false,
      missingKeys,
    })
    return
  }

  if (missingKeys.length > 0) {
    sendJson(res, 200, {
      isConfigured: false,
      isConnected: false,
      missingKeys,
    })
    return
  }

  const connection = await getOwnerConnection()
  sendJson(res, 200, {
    isConfigured: true,
    isConnected: Boolean(connection),
    missingKeys,
  })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const action = getDropboxAction(req)

    if (action === "auth-url") {
      await handleAuthUrl(req, res)
      return
    }

    if (action === "callback") {
      await handleCallback(req, res)
      return
    }

    await handleStatus(req, res)
  } catch (error) {
    handleApiError(res, error)
  }
}
