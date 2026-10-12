import { convertClientSubmission, getSubmissionDownloadFile, listClientSubmissions } from "../server/api/client-submissions.js"
import { getDropboxTemporaryLink, getOwnerAccessToken } from "../server/api/dropbox.js"
import { HttpError, getQueryParam, handleApiError, readJsonBody, sendJson, type ApiRequest, type ApiResponse } from "../server/api/http.js"
import { requireVerifiedUser } from "../server/api/session.js"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  try {
    if (req.method !== "GET" && req.method !== "POST") throw new HttpError(405, "Use GET or POST for this endpoint.")
    const user = await requireVerifiedUser(req)
    if (req.method === "POST") {
      const body = await readJsonBody<Record<string, unknown>>(req)
      sendJson(res, 200, { assignmentId: await convertClientSubmission(user, body) })
    } else if (getQueryParam(req, "action") === "download") {
      const providerFileId = await getSubmissionDownloadFile(user.id, getQueryParam(req, "submissionId"), getQueryParam(req, "fileIndex"))
      const accessToken = await getOwnerAccessToken()
      sendJson(res, 200, { url: await getDropboxTemporaryLink(accessToken, providerFileId) })
    } else {
      sendJson(res, 200, await listClientSubmissions(user.id, {
        search: getQueryParam(req, "search") ?? "",
        status: getQueryParam(req, "status") ?? "new",
        cursor: getQueryParam(req, "cursor"),
      }))
    }
  } catch (error) { handleApiError(res, error) }
}
