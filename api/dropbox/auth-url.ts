import { createDropboxAuthUrl } from "../_lib/dropbox.js"
import {
  handleApiError,
  readJsonBody,
  requireMethod,
  requireOwner,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../_lib/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "POST")
    const userId = requireOwner(req)
    const body = await readJsonBody<{ returnTo?: unknown }>(req)
    const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/")
      ? body.returnTo
      : "/dashboard"

    sendJson(res, 200, {
      url: createDropboxAuthUrl(req, { userId, returnTo }),
    })
  } catch (error) {
    handleApiError(res, error)
  }
}
