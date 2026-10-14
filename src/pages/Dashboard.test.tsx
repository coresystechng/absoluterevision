import { act, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Link, Route, Routes } from "react-router-dom"
import * as assignmentApi from "@/api/assignments"
import * as teamsApi from "@/api/teams"
import { getOrCreateUser } from "@/api/users"
import { useAssignment } from "@/hooks/useAssignment"
import { getWorkspaceGeneration, workspaceKeys } from "@/lib/workspace-cache"
import type { Assignment } from "@/types"
import { Dashboard } from "@/pages/Dashboard"
import { renderWithRouter } from "@/test/render"

const reloadTeams = vi.fn().mockResolvedValue(undefined)
const reloadAssignments = vi.fn().mockResolvedValue(undefined)
let realHooks = false
let teamState: Record<string, unknown>
let assignmentState: Record<string, unknown>

vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn().mockResolvedValue({ dashboardFilters: { types: [], priorities: [], statuses: [] }, id: "u1", email: "u@example.com", displayName: null, createdAt: "2026-01-01", activeTeamId: 1 }) }))
vi.mock("@/api/teams", () => ({ getTeams: vi.fn(), getTeamMembers: vi.fn() }))
vi.mock("@/api/assignments", () => ({ getAll: vi.fn(), getById: vi.fn() }))
vi.mock("@/hooks/useTeams", async (original) => { const actual = await original<typeof import("@/hooks/useTeams")>(); return { useTeams: (...args: Parameters<typeof actual.useTeams>) => realHooks ? actual.useTeams(...args) : teamState } })
vi.mock("@/hooks/useAssignments", async (original) => { const actual = await original<typeof import("@/hooks/useAssignments")>(); return { useAssignments: (...args: Parameters<typeof actual.useAssignments>) => realHooks ? actual.useAssignments(...args) : assignmentState } })
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }))
vi.mock("@/components/AssignmentDialog", () => ({ AssignmentDialog: () => null }))
vi.mock("@/components/AssignmentCard", () => ({ AssignmentCard: ({ assignment }: { assignment: { title: string } }) => <article><Link to="/assignments/1">{assignment.title}</Link></article> }))

describe("Dashboard state precedence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realHooks = false
    teamState = { teams: [], members: [], isLoading: false, error: null, reloadTeams }
    assignmentState = { assignments: [], isLoading: false, isRefreshing: false, error: null, reload: reloadAssignments, create: vi.fn(), update: vi.fn(), remove: vi.fn() }
  })

  it("shows only the team error and retries the team loader", async () => {
    teamState.error = new Error("failed")
    const { user } = renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />, { workspaceUser: { id: "u1", email: "u@example.com", displayName: null } })
    expect(await screen.findByRole("heading", { name: "Could not load your teams" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: /no assignments/i })).not.toBeInTheDocument()
    const before = reloadTeams.mock.calls.length
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(reloadTeams).toHaveBeenCalledTimes(before + 1)
  })

  it("shows only the assignment error and retries assignments", async () => {
    teamState.teams = [{ id: 1, name: "Team", role: "admin", memberCount: 1 }]
    assignmentState.error = new Error("failed")
    const { user } = renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />, { workspaceUser: { id: "u1", email: "u@example.com", displayName: null } })
    expect(await screen.findByRole("heading", { name: "Could not load assignments" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: /no assignments/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(reloadAssignments).toHaveBeenCalledOnce()
  })

  it("shows the current team instead of assignment creation controls for members", async () => {
    teamState.teams = [{ id: 1, name: "Research Team", role: "member", memberCount: 2 }]
    renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />, { workspaceUser: { id: "u1", email: "u@example.com", displayName: null } })

    await waitFor(() => expect(screen.getByText("Current team")).toBeVisible())
    expect(screen.getByText("Research Team")).toBeVisible()
    expect(screen.queryByRole("button", { name: "New assignment" })).not.toBeInTheDocument()
    expect(screen.queryByText("Only team administrators can create assignments.")).not.toBeInTheDocument()
  })

  it("stacks status selections with OR semantics and exposes removable chips", async () => {
    teamState.teams = [{ id: 1, name: "Research Team", role: "admin", memberCount: 1 }]
    assignmentState.assignments = [
      { id: 1, title: "Queued task", category: "Assignment", priority: "high", status: "not-started", dueDate: null, dueTime: null },
      { id: 2, title: "Active task", category: "Assignment", priority: "medium", status: "ongoing", dueDate: null, dueTime: null },
      { id: 3, title: "Finished task", category: "Assignment", priority: "low", status: "completed", dueDate: null, dueTime: null },
    ]
    const { user } = renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />, { workspaceUser: { id: "u1", email: "u@example.com", displayName: null } })

    await user.click(await screen.findByRole("button", { name: "Filter" }))
    await user.click(screen.getByRole("button", { name: "Filter by status: All Statuses" }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Not Started" }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Ongoing" }))
    await user.keyboard("{Escape}")

    expect(screen.getByText("Queued task")).toBeVisible()
    expect(screen.getByText("Active task")).toBeVisible()
    expect(screen.queryByText("Finished task")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove Not Started filter" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Remove Ongoing filter" })).toBeVisible()
    expect(screen.getByLabelText("2 active filters")).toBeVisible()
  })
})

const authUser = { id: "u1", email: "u@example.com", displayName: null }
const row: Assignment = { id: 1, trackingCode: "AR-test", userId: "u1", teamId: 1, teamName: "Team", currentUserRole: "admin", assigneeUserId: "u1", assigneeName: "User", assigneeEmail: "u@example.com", title: "Cached assignment", category: "Assignment", priority: "high", status: "ongoing", progressStage: "ai-draft", dueDate: null, dueTime: null, progress: 0, notes: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }
function DetailHarness() { const { data } = useAssignment("u1", 1); return <><h1>{data?.title} detail</h1><Link to="/dashboard">Back to dashboard</Link></> }
it("gates real list reads and reuses them through dashboard-detail-dashboard navigation", async () => {
  vi.clearAllMocks()
  realHooks = true
  vi.mocked(assignmentApi.getAll).mockReset().mockResolvedValue([row])
  vi.mocked(assignmentApi.getById).mockResolvedValue(row)
  vi.mocked(teamsApi.getTeams).mockResolvedValue([{ id: 1, name: "Team", adminUserId: "u1", role: "admin", memberCount: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" }])
  vi.mocked(teamsApi.getTeamMembers).mockResolvedValue([])
  let resolve!: (value: Awaited<ReturnType<typeof getOrCreateUser>>) => void
  vi.mocked(getOrCreateUser).mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const { user } = renderWithRouter(<Routes><Route path="/dashboard" element={<Dashboard user={authUser} onSignOut={vi.fn()} />} /><Route path="/assignments/:id" element={<DetailHarness />} /></Routes>, { initialEntries: ["/dashboard"], workspaceUser: authUser })
  expect(assignmentApi.getAll).not.toHaveBeenCalled()
  expect(teamsApi.getTeams).not.toHaveBeenCalled()
  await act(async () => resolve({ ...authUser, activeTeamId: 1, dashboardFilters: { types: [], priorities: [], statuses: [] }, createdAt: "2026-01-01" }))
  await user.click(await screen.findByRole("link", { name: "Cached assignment" }))
  await screen.findByRole("heading", { name: "Cached assignment detail" })
  await user.click(screen.getByRole("link", { name: "Back to dashboard" }))
  await screen.findByRole("link", { name: "Cached assignment" })
  expect(getOrCreateUser).toHaveBeenCalledTimes(1)
  expect(teamsApi.getTeams).toHaveBeenCalledTimes(1)
  expect(assignmentApi.getAll).toHaveBeenCalledTimes(1)
  expect(assignmentApi.getAll).toHaveBeenCalledWith("u1", 1)
  vi.mocked(teamsApi.getTeams).mockRejectedValueOnce(new Error("Background failure"))
  await act(async () => { await getWorkspaceGeneration()!.client.refetchQueries({ queryKey: workspaceKeys.teams("u1") }) })
  expect(screen.getByRole("link", { name: "Cached assignment" })).toBeVisible()
  expect(screen.queryByText("No assignments yet")).not.toBeInTheDocument()
  expect(assignmentApi.getAll).toHaveBeenCalledTimes(1)
})
