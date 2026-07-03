import { exchangeDropboxCode, parseOAuthState } from "../_lib/dropbox.js"
import {
  HttpError,
  getQueryParam,
  getRequestOrigin,
  handleApiError,
  requireMethod,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http.js"

function redirect(res: ApiResponse, url: string) {
  res.statusCode = 302
  res.setHeader("location", url)
  res.end()
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
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
  } catch (callbackError) {
    handleApiError(res, callbackError)
  }
}
