import { beforeEach, describe, expect, it, vi } from "vitest"
import { HttpError } from "./http.js"

const publicRoutes = vi.hoisted(() => ({ intake: vi.fn(), verifyEmail: vi.fn() }))
vi.mock("../routes/client-submissions/intake.js", () => ({ default: publicRoutes.intake }))
vi.mock("../routes/client-submissions/verify-email.js", () => ({ default: publicRoutes.verifyEmail }))
const mocks = vi.hoisted(() => ({ countNewClientSubmissions: vi.fn(), requireVerifiedUser: vi.fn(), listClientSubmissions: vi.fn(), convertClientSubmission: vi.fn(), getSubmissionDownloadFile: vi.fn(), getOwnerAccessToken: vi.fn(), getDropboxTemporaryLink: vi.fn() }))
vi.mock("./session.js", () => ({ requireVerifiedUser: mocks.requireVerifiedUser }))
vi.mock("./client-submissions.js", () => mocks)
vi.mock("./dropbox.js", () => mocks)
import handler from "../../api/client-submissions.js"

const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireVerifiedUser.mockResolvedValue({ id: "verified-admin", email: "admin@example.com", name: "Admin" })
})

describe("authenticated inbox API", () => {
  it("dispatches public intake and verification without granting inbox access", async () => {
    for (const subroute of ["intake", "verify-email"]) {
      const req = { method: "POST", headers: {}, query: { subroute } }
      const res = response()
      await handler(req as never, res as never)
      expect(subroute === "intake" ? publicRoutes.intake : publicRoutes.verifyEmail).toHaveBeenCalledWith(req, res)
    }
    expect(mocks.requireVerifiedUser).not.toHaveBeenCalled()
    expect(mocks.listClientSubmissions).not.toHaveBeenCalled()
  })

  it("returns the unconverted count using verified identity", async () => {
    mocks.countNewClientSubmissions.mockResolvedValue(27)
    const res = response()
    await handler({ method: "GET", headers: {}, query: { action: "count" } } as never, res as never)
    expect(mocks.countNewClientSubmissions).toHaveBeenCalledWith("verified-admin")
    expect(res.json).toHaveBeenCalledWith({ count: 27 })
  })

  it("uses verified identity, ignores forged user IDs, and disables caching", async () => {
    mocks.listClientSubmissions.mockResolvedValue({ submissions: [], teams: [], nextCursor: null })
    const res = response()
    await handler({ method: "GET", headers: { "x-absolute-revision-user-id": "forged" }, query: {} } as never, res as never)
    expect(mocks.listClientSubmissions).toHaveBeenCalledWith("verified-admin", { search: "", status: "new", cursor: null })
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("rejects unauthenticated requests without reading client data", async () => {
    mocks.requireVerifiedUser.mockRejectedValue(new HttpError(401, "Sign in"))
    const res = response()
    await handler({ method: "GET", headers: {} } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(mocks.listClientSubmissions).not.toHaveBeenCalled()
  })

  it("checks file access before obtaining any Dropbox link", async () => {
    mocks.getSubmissionDownloadFile.mockRejectedValue(new HttpError(403, "Access denied"))
    const res = response()
    await handler({ method: "GET", headers: {}, query: { action: "download", submissionId: "id", fileIndex: "0" } } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mocks.getOwnerAccessToken).not.toHaveBeenCalled()
  })

  it("returns the converted assignment ID", async () => {
    mocks.convertClientSubmission.mockResolvedValue(42)
    const res = response()
    await handler({ method: "POST", headers: {}, body: { submissionId: "id", teamId: 1 } } as never, res as never)
    expect(res.json).toHaveBeenCalledWith({ assignmentId: 42 })
    expect(mocks.convertClientSubmission).toHaveBeenCalledWith(expect.objectContaining({ id: "verified-admin" }), { submissionId: "id", teamId: 1 })
  })
})
