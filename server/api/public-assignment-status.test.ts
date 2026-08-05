import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({ initFilesDb: vi.fn(), query: vi.fn() }))
vi.mock("./db.js", () => db)

import { getPublicAssignmentStatus, normalizeTrackingCode, normalizeTrackingCredentials } from "./public-assignment-status.js"

const code = "AR-7A91F2-88C4D0-1B6E35-902AF8"
const reference = "AR-902AF8"
const accessCode = "7A91F2-88C4D0-1B6E35"
function row(overrides: Record<string, unknown> = {}) {
  return {
    tracking_code: code,
    category: "Assignment",
    status: "ongoing",
    progress_stage: "humaned",
    due_date: "2026-08-20",
    updated_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  db.initFilesDb.mockResolvedValue(undefined)
})

describe("public assignment status", () => {
  it("normalizes valid pasted IDs and rejects malformed or numeric values", () => {
    expect(normalizeTrackingCode(` ${code.toLowerCase()} `)).toBe(code)
    expect(normalizeTrackingCode("42")).toBeNull()
    expect(normalizeTrackingCode("AR-123")).toBeNull()
    expect(normalizeTrackingCredentials(reference.toLowerCase(), accessCode.toLowerCase())).toEqual({ reference, trackingCode: code })
  })

  it("uses one parameterized, explicitly scoped query", async () => {
    db.query.mockResolvedValue([row()])
    await getPublicAssignmentStatus(reference.toLowerCase(), accessCode.toLowerCase())
    const [sql, params] = db.query.mock.calls[0]
    expect(params).toEqual([code])
    expect(sql).toContain("WHERE tracking_code = $1")
    expect(sql).not.toMatch(/SELECT\s+\*|a\.\*/i)
    expect(sql).not.toMatch(/JOIN\s+(users|teams|team_memberships|assignment_files|assignment_activities)/i)
  })

  it("returns null without querying for malformed IDs and unknown records", async () => {
    await expect(getPublicAssignmentStatus("99", accessCode)).resolves.toBeNull()
    expect(db.initFilesDb).not.toHaveBeenCalled()
    db.query.mockResolvedValue([])
    await expect(getPublicAssignmentStatus(reference, accessCode)).resolves.toBeNull()
  })

  it("maps terminal and legacy values while calculating progress", async () => {
    db.query.mockResolvedValueOnce([row({ status: "completed", progress_stage: "humaned" })])
      .mockResolvedValueOnce([row({ status: "legacy", progress_stage: "legacy" })])
    await expect(getPublicAssignmentStatus(reference, accessCode)).resolves.toMatchObject({ status: "completed", progress: 100, progressStage: "humaned" })
    await expect(getPublicAssignmentStatus(reference, accessCode)).resolves.toMatchObject({ status: "not-started", progress: 0, progressStage: "ai-draft" })
  })

  it("serializes date-only values and returns exactly seven safe keys", async () => {
    db.query.mockResolvedValue([row({ category: "unknown", due_date: new Date("2026-08-20T23:00:00.000Z"), updated_at: new Date("2026-08-01T10:00:00.000Z") })])
    const result = await getPublicAssignmentStatus(reference, accessCode)
    expect(result).toEqual({ reference, category: null, status: "ongoing", progressStage: "humaned", progress: 30, dueDate: "2026-08-20" })
    expect(Object.keys(result ?? {})).toEqual(["reference", "category", "status", "progressStage", "progress", "dueDate"])
    expect(result).not.toHaveProperty("id")
    expect(result).not.toHaveProperty("title")
    expect(result).not.toHaveProperty("notes")
  })
})
