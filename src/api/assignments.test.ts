import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  initDb: vi.fn(),
  query: vi.fn(),
}))

vi.mock("@/lib/db", () => dbMocks)

import {
  getAll,
  getById,
  updateProgressStage,
  updateStatus,
} from "@/api/assignments"

function assignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    user_id: "admin-user",
    team_id: 7,
    team_name: "Revision Team",
    current_user_role: "admin",
    assignee_user_id: "assigned-user",
    assignee_email: "assigned@example.com",
    assignee_display_name: "Assigned Writer",
    title: "Research summary",
    category: "Assignment",
    priority: "medium",
    status: "ongoing",
    progress_stage: "humaned",
    due_date: null,
    due_time: null,
    progress: 30,
    notes: null,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  dbMocks.initDb.mockReset()
  dbMocks.initDb.mockResolvedValue(undefined)
  dbMocks.query.mockReset()
})

describe("assignment access control", () => {
  it("loads assignments through team membership without an assignee filter", async () => {
    dbMocks.query.mockResolvedValueOnce([assignmentRow()])

    const assignments = await getAll("member-user", 7)

    const [sql, params] = dbMocks.query.mock.calls[0]
    expect(sql).toContain("tm.user_id = $1")
    expect(sql).not.toMatch(/WHERE[\s\S]*a\.assignee_user_id\s*=/)
    expect(params).toEqual(["member-user", 7])
    expect(assignments).toHaveLength(1)
  })

  it("returns a team assignment that belongs to a different assignee", async () => {
    dbMocks.query.mockResolvedValueOnce([
      assignmentRow({ current_user_role: "member", assignee_user_id: "someone-else" }),
    ])

    const assignment = await getById("member-user", 42)

    expect(assignment?.assigneeUserId).toBe("someone-else")
    expect(assignment?.currentUserRole).toBe("member")
  })

  it("blocks a non-admin status update before issuing UPDATE", async () => {
    dbMocks.query.mockResolvedValueOnce([])

    await expect(updateStatus("member-user", 42, "completed")).resolves.toBeNull()
    expect(dbMocks.query).toHaveBeenCalledTimes(1)
    expect(dbMocks.query.mock.calls.some(([sql]) => /^\s*UPDATE assignments/.test(sql))).toBe(false)
  })

  it("blocks a non-admin progress update before issuing UPDATE", async () => {
    dbMocks.query.mockResolvedValueOnce([])

    await expect(
      updateProgressStage("member-user", 42, "grammar-check"),
    ).resolves.toBeNull()
    expect(dbMocks.query).toHaveBeenCalledTimes(1)
    expect(dbMocks.query.mock.calls.some(([sql]) => /^\s*UPDATE assignments/.test(sql))).toBe(false)
  })

  it("maps an admin completed status update to final progress", async () => {
    dbMocks.query
      .mockResolvedValueOnce([assignmentRow()])
      .mockResolvedValueOnce([{ id: 42 }])
      .mockResolvedValueOnce([
        assignmentRow({ status: "completed", progress_stage: "final-review", progress: 100 }),
      ])
      .mockResolvedValueOnce([])

    const assignment = await updateStatus("admin-user", 42, "completed", "Admin")

    const updateCall = dbMocks.query.mock.calls.find(([sql]) =>
      /^\s*UPDATE assignments/.test(sql),
    )
    expect(updateCall?.[1]).toEqual([42, "completed", "final-review", 100])
    expect(assignment).toMatchObject({
      status: "completed",
      progressStage: "final-review",
      progress: 100,
    })
  })
})
