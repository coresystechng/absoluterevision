import { isFilesDatabaseConfigured } from "../server/api/db.js"
import { releaseSignupInvite, redeemSignupInvite, reserveSignupInvite } from "../server/api/signup-invites.js"
import { HttpError, handleApiError, readJsonBody, requireMethod, sendJson, type ApiRequest, type ApiResponse } from "../server/api/http.js"
import { enforceRateLimit } from "../server/api/rate-limit.js"

const invalidMessage = "Registration is invite-only. Request a valid access token from Absolute Revision."

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  try {
    requireMethod(req, "POST")
    enforceRateLimit(req, "signup-invites", 12, 10 * 60 * 1000)
    if (!isFilesDatabaseConfigured()) throw new HttpError(503, "Registration is temporarily unavailable.")

    const body = await readJsonBody<{ action?: unknown; token?: unknown; email?: unknown; receipt?: unknown }>(req)
    const action = typeof body.action === "string" ? body.action : ""
    const token = typeof body.token === "string" ? body.token : ""
    const email = typeof body.email === "string" ? body.email : ""
    const receipt = typeof body.receipt === "string" ? body.receipt : ""

    if (action === "reserve") {
      const reservation = await reserveSignupInvite(token, email)
      if (!reservation) throw new HttpError(403, invalidMessage)
      sendJson(res, 200, { receipt: reservation })
      return
    }
    if (action === "redeem") {
      if (!await redeemSignupInvite(token, email, receipt)) throw new HttpError(403, invalidMessage)
      sendJson(res, 200, { redeemed: true })
      return
    }
    if (action === "release") {
      await releaseSignupInvite(token, email, receipt)
      sendJson(res, 200, { released: true })
      return
    }
    throw new HttpError(400, "Unsupported invitation action.")
  } catch (error) {
    handleApiError(res, error)
  }
}
