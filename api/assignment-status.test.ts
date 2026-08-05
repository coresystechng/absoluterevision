import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPublicAssignmentStatus: vi.fn(),
  normalizeTrackingCode: vi.fn(),
  isFilesDatabaseConfigured: vi.fn(),
}))
vi.mock("../server/api/public-assignment-status.js", () => ({
  getPublicAssignmentStatus: mocks.getPublicAssignmentStatus,
  normalizeTrackingCode: mocks.normalizeTrackingCode,
}))
vi.mock("../server/api/db.js", () => ({ isFilesDatabaseConfigured: mocks.isFilesDatabaseConfigured }))

import handler from "./assignment-status.js"

const code = "AR-7A91F2-88C4D0-1B6E35-902AF8"
const assignment = {
  trackingCode: code,
  category: "Assignment",
  status: "ongoing",
  progressStage: "humaned",
  progress: 30,
  dueDate: "2026-08-20",
  updatedAt: "2026-08-01T10:00:00.000Z",
}

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.isFilesDatabaseConfigured.mockReturnValue(true)
  mocks.normalizeTrackingCode.mockImplementation((value: string | null | undefined) => value === code ? code : null)
})

describe("assignment status endpoint", () => {
  it("returns exactly the public contract for GET requests", async () => {
    mocks.getPublicAssignmentStatus.mockResolvedValue(assignment)
    const res = response()
    await handler({ method: "GET", headers: {}, query: { trackingId: code } } as never, res as never)

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ assignment })
    expect(Object.keys(assignment)).toEqual(["trackingCode", "category", "status", "progressStage", "progress", "dueDate", "updatedAt"])
  })

  it.each([
    ["missing", undefined],
    ["malformed", "123"],
    ["unknown", code],
  ])("uses the same 404 response for %s IDs", async (_label, trackingId) => {
    if (trackingId === code) mocks.getPublicAssignmentStatus.mockResolvedValue(null)
    const res = response()
    await handler({ method: "GET", headers: {}, query: trackingId ? { trackingId } : {} } as never, res as never)

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: "Assignment not found. Check the ID and try again." })
  })

  it("rejects non-GET requests with no-store", async () => {
    const res = response()
    await handler({ method: "POST", headers: {} } as never, res as never)
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it("returns a safe unavailable response without querying Neon", async () => {
    mocks.isFilesDatabaseConfigured.mockReturnValue(false)
    const res = response()
    await handler({ method: "GET", headers: {}, query: { trackingId: code } } as never, res as never)
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(503)
    expect(mocks.getPublicAssignmentStatus).not.toHaveBeenCalled()
  })
})
