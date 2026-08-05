import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPublicAssignmentStatus: vi.fn(),
  normalizeTrackingCredentials: vi.fn(),
  isFilesDatabaseConfigured: vi.fn(),
}))
vi.mock("./public-assignment-status.js", () => ({
  getPublicAssignmentStatus: mocks.getPublicAssignmentStatus,
  normalizeTrackingCredentials: mocks.normalizeTrackingCredentials,
}))
vi.mock("./db.js", () => ({ isFilesDatabaseConfigured: mocks.isFilesDatabaseConfigured }))

import handler from "../../api/assignment-status.js"

const code = "AR-7A91F2-88C4D0-1B6E35-902AF8"
const reference = "AR-902AF8"
const accessCode = "7A91F2-88C4D0-1B6E35"
const assignment = {
  reference,
  category: "Assignment",
  status: "ongoing",
  progressStage: "humaned",
  progress: 30,
  dueDate: "2026-08-20",
}

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.isFilesDatabaseConfigured.mockReturnValue(true)
  mocks.normalizeTrackingCredentials.mockImplementation((ref: string | null | undefined, access: string | null | undefined) => ref === reference && access === accessCode ? { reference, trackingCode: code } : null)
})

describe("assignment status endpoint", () => {
  it("returns exactly the public contract for POST requests", async () => {
    mocks.getPublicAssignmentStatus.mockResolvedValue(assignment)
    const res = response()
    await handler({ method: "POST", headers: {}, body: { reference, accessCode } } as never, res as never)

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ assignment })
    expect(Object.keys(assignment)).toEqual(["reference", "category", "status", "progressStage", "progress", "dueDate"])
  })

  it.each([
    ["missing", undefined],
    ["malformed", "123"],
    ["unknown", reference],
  ])("uses the same 404 response for %s credentials", async (_label, trackingReference) => {
    if (trackingReference === reference) mocks.getPublicAssignmentStatus.mockResolvedValue(null)
    const res = response()
    await handler({ method: "POST", headers: {}, body: trackingReference ? { reference: trackingReference, accessCode } : {} } as never, res as never)

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: "Assignment not found. Check the ID and try again." })
  })

  it("rejects non-POST requests with no-store", async () => {
    const res = response()
    await handler({ method: "GET", headers: {} } as never, res as never)
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it("returns a safe unavailable response without querying Neon", async () => {
    mocks.isFilesDatabaseConfigured.mockReturnValue(false)
    const res = response()
    await handler({ method: "POST", headers: {}, body: { reference, accessCode } } as never, res as never)
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0")
    expect(res.status).toHaveBeenCalledWith(503)
    expect(mocks.getPublicAssignmentStatus).not.toHaveBeenCalled()
  })
})
