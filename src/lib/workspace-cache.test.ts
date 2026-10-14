import { afterEach, describe, expect, it, vi } from "vitest"
import { acquireWorkspace, disposeWorkspace, getWorkspaceGeneration, purgeTeamAssignments, workspaceKeys } from "./workspace-cache"
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn() }))
afterEach(() => disposeWorkspace())
describe("workspace identity lifecycle", () => {
  it("reuses the same identity across route remounts", () => {
    expect(acquireWorkspace("A")).toBe(acquireWorkspace("A"))
  })
  it("clears the old client and publishes the new generation", () => {
    const old = acquireWorkspace("A")
    old.client.setQueryData(workspaceKeys.teams("A"), ["private"])
    const next = acquireWorkspace("B")
    expect(old.client.getQueryCache().getAll()).toHaveLength(0)
    expect(next.generation).toBeGreaterThan(old.generation)
    expect(getWorkspaceGeneration()).toBe(next)
    disposeWorkspace(old)
    expect(getWorkspaceGeneration()).toBe(next)
  })
  it("isolates team, identity and entity keys", () => {
    expect(workspaceKeys.assignments("A", 1)).not.toEqual(workspaceKeys.assignments("A", 2))
    expect(workspaceKeys.assignments("A", 1)).not.toEqual(workspaceKeys.assignments("B", 1))
    expect(workspaceKeys.assignment("A", 1)).not.toEqual(workspaceKeys.assignments("A", 1))
  })
  it("cancels unknown pending details on access changes so late permission data cannot refill them", async () => {
    const { client } = acquireWorkspace("A")
    let resolve!: (value: { teamId: number; currentUserRole: string }) => void
    const pending = client.fetchQuery({ queryKey: workspaceKeys.assignment("A", 1), queryFn: () => new Promise((done) => { resolve = done }) }).catch(() => undefined)
    await purgeTeamAssignments(client, "A", [1])
    resolve({ teamId: 1, currentUserRole: "admin" })
    await pending
    expect(client.getQueryData(workspaceKeys.assignment("A", 1))).toBeUndefined()
  })
})
