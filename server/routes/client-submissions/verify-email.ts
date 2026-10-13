import { sendSubmissionEmailCode, verifySubmissionEmailCode } from "../../api/submission-email.js"
import { handleApiError, HttpError, readJsonBody, requireMethod, sendJson, type ApiRequest, type ApiResponse } from "../../api/http.js"
import { enforceRateLimit } from "../../api/rate-limit.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  try {
    requireMethod(req, "POST")
    enforceRateLimit(req, "submission-email", 30, 3_600_000)
    const body = await readJsonBody<Record<string, unknown>>(req)
    if (body.action === "send") sendJson(res, 200, await sendSubmissionEmailCode(req, body.email))
    else if (body.action === "verify") sendJson(res, 200, await verifySubmissionEmailCode(body))
    else throw new HttpError(400, "Unsupported verification action.")
  } catch (error) { handleApiError(res, error) }
}
