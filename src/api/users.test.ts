import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  initDb: vi.fn(),
  query: vi.fn(),
}))

vi.mock("@/lib/db", () => dbMocks)

import { updateActiveTeamSelection } from "@/api/users"

function userRow(activeTeamId: number) {
  return {
    id: "user-1",
    email: "writer@example.com",
    display_name: "Writer",
    active_team_id: activeTeamId,
    dashboard_filter_type: "all",
    dashboard_filter_priority: "all",
    dashboard_filter_status: "all",
    created_at: "2026-07-17T10:00:00.000Z",
  }
}

beforeEach(() => {
  dbMocks.initDb.mockReset()
  dbMocks.initDb.mockResolvedValue(undefined)
  dbMocks.query.mockReset()
})

describe("active team preferences", () => {
  it("persists a team only through the user's membership", async () => {
    dbMocks.query.mockResolvedValueOnce([userRow(9)])

    const profile = await updateActiveTeamSelection("user-1", 9)

    const [sql, params] = dbMocks.query.mock.calls[0]
    expect(sql).toContain("FROM team_memberships")
    expect(sql).toContain("team_memberships.user_id = $1")
    expect(params).toEqual(["user-1", 9])
    expect(profile.activeTeamId).toBe(9)
  })

  it("rejects an invalid team id before querying the database", async () => {
    await expect(updateActiveTeamSelection("user-1", 0)).rejects.toThrow("Select a valid team.")
    expect(dbMocks.initDb).not.toHaveBeenCalled()
    expect(dbMocks.query).not.toHaveBeenCalled()
  })

  it("rejects a team the user does not belong to", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    dbMocks.query.mockResolvedValueOnce([])

    await expect(updateActiveTeamSelection("user-1", 12)).rejects.toThrow(
      "You can only select a team you belong to.",
    )
    consoleError.mockRestore()
  })
})
