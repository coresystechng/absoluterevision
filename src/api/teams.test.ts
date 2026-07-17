import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMocks = vi.hoisted(() => ({
  initDb: vi.fn(),
  query: vi.fn(),
}))

vi.mock("@/lib/db", () => dbMocks)

import { deleteTeam } from "@/api/teams"

beforeEach(() => {
  dbMocks.initDb.mockReset()
  dbMocks.initDb.mockResolvedValue(undefined)
  dbMocks.query.mockReset()
})

describe("workspace deletion", () => {
  it("deletes an administered workspace and selects a remaining team", async () => {
    dbMocks.query
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ team_id: 9 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(deleteTeam("user-1", 7)).resolves.toBe(9)

    const deleteCall = dbMocks.query.mock.calls.find(([sql]) =>
      /^\s*DELETE FROM teams/.test(sql),
    )
    expect(deleteCall?.[1]).toEqual([7, "user-1"])

    const finalUpdate = dbMocks.query.mock.calls[4]
    expect(finalUpdate[0]).toContain("SET active_team_id = $2")
    expect(finalUpdate[1]).toEqual(["user-1", 9])
  })

  it("prevents deletion of the user's only accessible workspace", async () => {
    dbMocks.query
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([])

    await expect(deleteTeam("user-1", 7)).rejects.toThrow(
      "Create another team before deleting your only workspace.",
    )
    expect(dbMocks.query).toHaveBeenCalledTimes(2)
  })

  it("prevents non-admin members from deleting a workspace", async () => {
    dbMocks.query.mockResolvedValueOnce([])

    await expect(deleteTeam("member-1", 7)).rejects.toThrow(
      "Only team admins can manage team members.",
    )
    expect(dbMocks.query).toHaveBeenCalledTimes(1)
  })
})
