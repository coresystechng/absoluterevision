import { beforeEach, describe, expect, it, vi } from "vitest"
import { HttpError } from "./http.js"

const mocks = vi.hoisted(() => ({ requireVerifiedUser: vi.fn(), getAssignmentFile: vi.fn(), getOwnerAccessToken: vi.fn(), getDropboxTemporaryLink: vi.fn() }))
vi.mock("./session.js", () => mocks)
vi.mock("./db.js", () => mocks)
vi.mock("./dropbox.js", () => mocks)
import handler from "../../api/assignment-files/download.js"

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireVerifiedUser.mockResolvedValue({ id: "editor", email: "editor@example.com", name: "Editor" })
  mocks.getOwnerAccessToken.mockResolvedValue("token")
  mocks.getDropboxTemporaryLink.mockResolvedValue("https://example.com/download")
})

describe("converted assignment file access", () => {
  it("does not accept a forged admin ID without a verified session", async () => {
    mocks.requireVerifiedUser.mockRejectedValue(new HttpError(401, "Sign in"))
    const res = response()
    await handler({ method: "GET", headers: { "x-absolute-revision-user-id": "admin" }, query: { fileId: "1" } } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(mocks.getAssignmentFile).not.toHaveBeenCalled()
  })

  it("allows the verified assignee to download a converted file", async () => {
    mocks.getAssignmentFile.mockResolvedValue({ provider_file_id: "client-file", current_user_role: "member", assignee_user_id: "editor", status: "ready" })
    const res = response()
    await handler({ method: "GET", headers: { "x-absolute-revision-user-id": "forged" }, query: { fileId: "1" } } as never, res as never)
    expect(mocks.getAssignmentFile).toHaveBeenCalledWith("editor", 1)
    expect(res.json).toHaveBeenCalledWith({ url: "https://example.com/download" })
  })

  it("rejects other team members before calling Dropbox", async () => {
    mocks.getAssignmentFile.mockResolvedValue({ current_user_role: "member", assignee_user_id: "someone-else", status: "ready" })
    const res = response()
    await handler({ method: "GET", headers: {}, query: { fileId: "1" } } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mocks.getOwnerAccessToken).not.toHaveBeenCalled()
  })
})
