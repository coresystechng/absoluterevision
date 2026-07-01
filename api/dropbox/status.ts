import { getOwnerConnection } from "../_lib/db"
import { isDropboxConfigured } from "../_lib/dropbox"
import { handleApiError, requireMethod, requireOwner, sendJson, type ApiRequest, type ApiResponse } from "../_lib/http"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "GET")
    requireOwner(req)

    const isConfigured = isDropboxConfigured()
    const connection = isConfigured ? await getOwnerConnection() : null
    sendJson(res, 200, {
      isConfigured,
      isConnected: Boolean(connection),
    })
  } catch (error) {
    handleApiError(res, error)
  }
}
