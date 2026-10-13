import { createSubmissionIntake, finalizeSubmissionIntake, retrySubmissionIntake } from "../../api/client-submissions.js"
import { handleApiError, readJsonBody, requireMethod, sendJson, type ApiRequest, type ApiResponse } from "../../api/http.js"
import { enforceRateLimit } from "../../api/rate-limit.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  try {
    requireMethod(req, "POST")
    enforceRateLimit(req, "client-submission-intake", 30, 60 * 60 * 1000)
    const body = await readJsonBody<Record<string, unknown>>(req)
    if (body.action === "finalize") {
      await finalizeSubmissionIntake(body)
      sendJson(res, 200, { finalized: true })
    } else if (body.action === "retry") {
      await retrySubmissionIntake(body)
      sendJson(res, 200, { retried: true })
    } else if (body.action === "create") {
      sendJson(res, 201, await createSubmissionIntake(body))
    } else {
      sendJson(res, 400, { error: "Unsupported submission action." })
    }
  } catch (error) { handleApiError(res, error) }
}
