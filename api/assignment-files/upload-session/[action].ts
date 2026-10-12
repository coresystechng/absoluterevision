import start from "../../../server/api/assignment-file-upload-session-start.js"
import append from "../../../server/api/assignment-file-upload-session-append.js"
import finish from "../../../server/api/assignment-file-upload-session-finish.js"
import { getQueryParam, sendJson, type ApiRequest, type ApiResponse } from "../../../server/api/http.js"

// Preserve the three public upload URLs while using one Vercel function.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  switch (getQueryParam(req, "action")) {
    case "start": return start(req, res)
    case "append": return append(req, res)
    case "finish": return finish(req, res)
    default: sendJson(res, 404, { error: "Upload session action not found." })
  }
}
