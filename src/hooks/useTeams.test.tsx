import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import type { TeamMember } from "@/types"
import type { ReactNode } from "react"
import * as api from "@/api/teams"
import { acquireWorkspace, disposeWorkspace, workspaceKeys } from "@/lib/workspace-cache"
import { useTeams } from "./useTeams"
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn() }))
vi.mock("@/api/teams", () => ({ getTeams: vi.fn(), getTeamMembers: vi.fn(), removeTeamMember: vi.fn(), deleteTeam: vi.fn() }))
afterEach(() => { disposeWorkspace(); vi.clearAllMocks() })
it("isolates late member responses after selecting another team", async () => {
  vi.mocked(api.getTeams).mockResolvedValue([])
  const memberA: TeamMember = { id: 1, teamId: 1, userId: "A", email: "a@example.com", displayName: "Alice", role: "admin", createdAt: "2026-01-01" }
  const memberB: TeamMember = { ...memberA, id: 2, teamId: 2, userId: "B", displayName: "Bob" }
  let resolve!: (value: TeamMember[]) => void
  vi.mocked(api.getTeamMembers).mockReturnValueOnce(new Promise((done) => { resolve = done })).mockResolvedValueOnce([memberB])
  const { client } = acquireWorkspace("A")
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, rerender } = renderHook(({ team }) => useTeams("A", team), { wrapper, initialProps: { team: 1 } })
  rerender({ team: 2 })
  await waitFor(() => expect(result.current.members).toEqual([memberB]))
  await act(async () => resolve([memberA]))
  expect(api.getTeamMembers).toHaveBeenNthCalledWith(2, "A", 2)
  expect(result.current.members).toEqual([memberB])
})

it("purges assignment permissions and refreshes roles after membership changes", async () => {
  const team = { id: 1, name: "Team", adminUserId: "A", role: "admin" as const, memberCount: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" }
  vi.mocked(api.getTeams).mockResolvedValueOnce([team]).mockResolvedValueOnce([{ ...team, role: "member" }])
  vi.mocked(api.getTeamMembers).mockResolvedValue([])
  vi.mocked(api.removeTeamMember).mockResolvedValue(undefined)
  const { client } = acquireWorkspace("A")
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useTeams("A", 1), { wrapper })
  await waitFor(() => expect(result.current.teams[0]?.role).toBe("admin"))
  client.setQueryData(workspaceKeys.assignments("A", 1), [{ id: 1, teamId: 1, currentUserRole: "admin" }])
  client.setQueryData(workspaceKeys.assignment("A", 1), { id: 1, teamId: 1, currentUserRole: "admin" })
  await act(async () => { await result.current.removeTeamMember(1, "Other") })
  await waitFor(() => expect(result.current.teams[0]?.role).toBe("member"))
  expect(client.getQueryData(workspaceKeys.assignments("A", 1))).toBeUndefined()
  expect(client.getQueryData(workspaceKeys.assignment("A", 1))).toBeUndefined()
  expect(api.getTeamMembers).toHaveBeenCalledTimes(2)
})
