import { timingSafeEqual } from "node:crypto"
import { cleanupExpiredSubmissions } from "../../server/api/submission-retention.js"
import { getHeader, handleApiError, HttpError, requireMethod, sendJson, type ApiRequest, type ApiResponse } from "../../server/api/http.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  try {
    requireMethod(req, "GET")
    const secret = process.env.CRON_SECRET
    if (!secret) throw new HttpError(503, "Scheduled cleanup is not configured.")
    const supplied = Buffer.from(getHeader(req.headers, "authorization") ?? "")
    const expected = Buffer.from(`Bearer ${secret}`)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, "Unauthorized.")
    const result = await cleanupExpiredSubmissions()
    sendJson(res, result.failed ? 503 : 200, result)
  } catch (error) { handleApiError(res, error) }
}
