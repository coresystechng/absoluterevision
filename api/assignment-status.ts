import { getPublicAssignmentStatus, normalizeTrackingCode } from "../server/api/public-assignment-status.js"
import { isFilesDatabaseConfigured } from "../server/api/db.js"
import {
  HttpError,
  getQueryParam,
  handleApiError,
  requireMethod,
  sendJson,
  type ApiRequest,
  type ApiResponse,
} from "../server/api/http.js"

const notFoundMessage = "Assignment not found. Check the ID and try again."

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  try {
    requireMethod(req, "GET")
    if (!isFilesDatabaseConfigured()) {
      throw new HttpError(503, "Assignment tracking is temporarily unavailable. Try again later.")
    }

    const trackingId = getQueryParam(req, "trackingId")
    if (!normalizeTrackingCode(trackingId)) {
      throw new HttpError(404, notFoundMessage)
    }

    const assignment = await getPublicAssignmentStatus(trackingId)
    if (!assignment) {
      throw new HttpError(404, notFoundMessage)
    }

    sendJson(res, 200, { assignment })
  } catch (error) {
    handleApiError(res, error)
  }
}
