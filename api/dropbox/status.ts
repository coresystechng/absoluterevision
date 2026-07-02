import { getOwnerConnection, isFilesDatabaseConfigured } from "../_lib/db"
import { getDropboxConfigStatus } from "../_lib/dropbox"
import { handleApiError, requireMethod, requireOwner, sendJson, type ApiRequest, type ApiResponse } from "../_lib/http"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    requireMethod(req, "GET")

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

    requireOwner(req)

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
