import { afterEach, describe, expect, it, vi } from "vitest"
import { getPublicAssignmentStatus } from "./public-assignment-status"

const assignment = {
  reference: "AR-902AF8",
  category: null,
  status: "ongoing",
  progressStage: "ai-draft",
  progress: 15,
  dueDate: null,
}

afterEach(() => vi.unstubAllGlobals())

describe("public status API", () => {
  it("posts credentials in the request body and returns a valid public response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignment }) })
    vi.stubGlobal("fetch", fetchMock)
    await expect(getPublicAssignmentStatus("AR-902AF8", "7A91F2-88C4D0-1B6E35")).resolves.toEqual(assignment)
    expect(fetchMock).toHaveBeenCalledWith("/api/assignment-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: "AR-902AF8", accessCode: "7A91F2-88C4D0-1B6E35" }),
    })
  })

  it.each([
    [404, "not-found"],
    [429, "rate-limited"],
    [500, "unavailable"],
  ])("maps HTTP %s to a safe %s error", async (status, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(getPublicAssignmentStatus(assignment.reference, "7A91F2-88C4D0-1B6E35")).rejects.toMatchObject({ kind })
  })

  it("rejects malformed successful payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignment: { reference: assignment.reference } }) }))
    await expect(getPublicAssignmentStatus(assignment.reference, "7A91F2-88C4D0-1B6E35")).rejects.toMatchObject({ kind: "unavailable" })
  })
})
