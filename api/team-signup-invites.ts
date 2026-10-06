import { requireVerifiedUser } from "../server/api/session.js"
import { createTeamSignupInvite, listTeamSignupInvites, revokeTeamSignupInvite } from "../server/api/signup-invites.js"
import { handleApiError, HttpError, readJsonBody, requireMethod, sendJson, type ApiRequest, type ApiResponse } from "../server/api/http.js"
import { enforceRateLimit } from "../server/api/rate-limit.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store")
  try {
    requireMethod(req, "POST")
    const user = await requireVerifiedUser(req)
    enforceRateLimit(req, `team-invites-${user.id}`, 30, 60_000)
    const body = await readJsonBody<Record<string, unknown>>(req)
    const teamId = typeof body.teamId === "number" ? body.teamId : 0
    if (body.action === "create") {
      sendJson(res, 201, await createTeamSignupInvite(user.id, teamId, typeof body.email === "string" ? body.email : ""))
    } else if (body.action === "list") {
      sendJson(res, 200, { invites: await listTeamSignupInvites(user.id, teamId) })
    } else if (body.action === "revoke") {
      await revokeTeamSignupInvite(user.id, teamId, typeof body.inviteId === "string" ? body.inviteId : "")
      sendJson(res, 200, { revoked: true })
    } else throw new HttpError(400, "Unsupported invitation action.")
  } catch (error) { handleApiError(res, error) }
}
