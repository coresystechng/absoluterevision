import { getPublicAssignmentStatus, normalizeTrackingCredentials } from "../server/api/public-assignment-status.js"
import { isFilesDatabaseConfigured } from "../server/api/db.js"
import {
  HttpError,
  handleApiError,
  readJsonBody,
  requireMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../server/api/http.js"
import { enforceRateLimit } from "../server/api/rate-limit.js"

const notFoundMessage = "Assignment not found. Check the ID and try again."

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  try {
    requireMethod(req, "POST")
    res.setHeader("Referrer-Policy", "no-referrer")
    enforceRateLimit(req, "assignment-status", 10, 5 * 60 * 1000)
    if (!isFilesDatabaseConfigured()) {
      throw new HttpError(503, "Assignment tracking is temporarily unavailable. Try again later.")
    }

    const body = await readJsonBody<{ reference?: unknown; accessCode?: unknown }>(req)
    const reference = typeof body.reference === "string" ? body.reference : null
    const accessCode = typeof body.accessCode === "string" ? body.accessCode : null
    if (!normalizeTrackingCredentials(reference, accessCode)) {
      throw new HttpError(404, notFoundMessage)
    }

    const assignment = await getPublicAssignmentStatus(reference, accessCode)
    if (!assignment) {
      throw new HttpError(404, notFoundMessage)
    }

    sendJson(res, 200, { assignment })
  } catch (error) {
    handleApiError(res, error)
  }
}
