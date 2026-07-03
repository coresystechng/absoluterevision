import { getOwnerConnection, isFilesDatabaseConfigured } from "../_lib/db.js"
import { getDropboxConfigStatus } from "../_lib/dropbox.js"
import { handleApiError, requireMethod, requireUser, sendJson, type ApiRequest, type ApiResponse } from "../_lib/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
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
  } catch (error) {
    handleApiError(res, error)
  }
}
