import { act, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { removeAll } from "@/api/assignments"
import * as users from "@/api/users"
import * as teams from "@/api/teams"
import { Settings } from "./Settings"
import { renderWithRouter } from "@/test/render"
import { getWorkspaceGeneration, workspaceKeys } from "@/lib/workspace-cache"
vi.mock("@/api/assignments", () => ({ removeAll: vi.fn() }))
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn(), updateProfile: vi.fn(), updateDashboardFilters: vi.fn(), updateActiveTeamSelection: vi.fn() }))
vi.mock("@/api/teams", () => ({ getTeams: vi.fn(), getTeamMembers: vi.fn() }))
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }))
vi.mock("@/components/SignupInvitations", () => ({ SignupInvitations: () => null }))
const user = { id: "A", email: "a@example.com", displayName: "Alice" }
const profile = { ...user, activeTeamId: 1, dashboardFilters: { types: [], priorities: [], statuses: [] }, createdAt: "2026-01-01" }
it("keeps unsaved profile drafts when background profile changes", async () => {
  vi.mocked(users.getOrCreateUser).mockResolvedValue(profile)
  vi.mocked(teams.getTeams).mockResolvedValue([])
  vi.mocked(teams.getTeamMembers).mockResolvedValue([])
  const { user: interaction } = renderWithRouter(<Settings user={user} onSignOut={vi.fn()} />, { workspaceUser: user })
  const input = await screen.findByLabelText("Display name")
  await interaction.clear(input)
  await interaction.type(input, "Unsaved draft")
  getWorkspaceGeneration()!.client.setQueryData(workspaceKeys.profile(user.id), { ...profile, displayName: "Background value" })
  await waitFor(() => expect(input).toHaveValue("Unsaved draft"))
})

it("bulk removal purges both administered teams and preserves member-only cache", async () => {
  vi.mocked(users.getOrCreateUser).mockResolvedValue(profile)
  vi.mocked(removeAll).mockResolvedValue(undefined)
  const team = { id: 1, name: "Admin 1", adminUserId: "A", role: "admin" as const, memberCount: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" }
  vi.mocked(teams.getTeams).mockResolvedValue([team, { ...team, id: 2, name: "Admin 2" }, { ...team, id: 3, role: "member", adminUserId: "Other" }])
  vi.mocked(teams.getTeamMembers).mockResolvedValue([])
  const { user: interaction } = renderWithRouter(<Settings user={user} onSignOut={vi.fn()} />, { workspaceUser: user })
  await screen.findByLabelText("Display name")
  const client = getWorkspaceGeneration()!.client
  await act(async () => { await client.refetchQueries({ queryKey: workspaceKeys.teams("A") }) })
  for (const id of [1, 2, 3]) client.setQueryData(workspaceKeys.assignments("A", id), [{ id, teamId: id, title: `Team ${id}` }])
  await interaction.click(screen.getByRole("button", { name: "Delete all assignments" }))
  await interaction.click(screen.getByRole("button", { name: "Delete all" }))
  await waitFor(() => expect(client.getQueryData(workspaceKeys.assignments("A", 1))).toBeUndefined())
  expect(client.getQueryData(workspaceKeys.assignments("A", 2))).toBeUndefined()
  expect(client.getQueryData(workspaceKeys.assignments("A", 3))).toEqual([{ id: 3, teamId: 3, title: "Team 3" }])
  expect(removeAll).toHaveBeenCalledWith("A")
})
