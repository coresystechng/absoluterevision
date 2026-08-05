import { afterEach, describe, expect, it, vi } from "vitest"
import { getPublicAssignmentStatus } from "./public-assignment-status"

const assignment = {
  trackingCode: "AR-7A91F2-88C4D0-1B6E35-902AF8",
  category: null,
  status: "ongoing",
  progressStage: "ai-draft",
  progress: 15,
  dueDate: null,
  updatedAt: "2026-08-01T00:00:00.000Z",
}

afterEach(() => vi.unstubAllGlobals())

describe("public status API", () => {
  it("uses URLSearchParams and returns a valid public response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignment }) })
    vi.stubGlobal("fetch", fetchMock)
    await expect(getPublicAssignmentStatus("AR code&+")).resolves.toEqual(assignment)
    expect(fetchMock).toHaveBeenCalledWith("/api/assignment-status?trackingId=AR+code%26%2B")
  })

  it.each([
    [404, "not-found"],
    [429, "rate-limited"],
    [500, "unavailable"],
  ])("maps HTTP %s to a safe %s error", async (status, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(getPublicAssignmentStatus(assignment.trackingCode)).rejects.toMatchObject({ kind })
  })

  it("rejects malformed successful payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignment: { trackingCode: assignment.trackingCode } }) }))
    await expect(getPublicAssignmentStatus(assignment.trackingCode)).rejects.toMatchObject({ kind: "unavailable" })
  })
})
