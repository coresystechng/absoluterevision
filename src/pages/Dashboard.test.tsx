import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Dashboard } from "@/pages/Dashboard"
import { renderWithRouter } from "@/test/render"

const reloadTeams = vi.fn().mockResolvedValue(undefined)
const reloadAssignments = vi.fn().mockResolvedValue(undefined)
let teamState: Record<string, unknown>
let assignmentState: Record<string, unknown>

vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn().mockResolvedValue({ dashboardFilters: { types: [], priorities: [], statuses: [] }, activeTeamId: null }) }))
vi.mock("@/hooks/useTeams", () => ({ useTeams: () => teamState }))
vi.mock("@/hooks/useAssignments", () => ({ useAssignments: () => assignmentState }))
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }))
vi.mock("@/components/AssignmentDialog", () => ({ AssignmentDialog: () => null }))
vi.mock("@/components/AssignmentCard", () => ({ AssignmentCard: ({ assignment }: { assignment: { title: string } }) => <article>{assignment.title}</article> }))

describe("Dashboard state precedence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    teamState = { teams: [], members: [], isLoading: false, error: null, reloadTeams }
    assignmentState = { assignments: [], isLoading: false, isRefreshing: false, error: null, reload: reloadAssignments, create: vi.fn(), update: vi.fn(), remove: vi.fn() }
  })

  it("shows only the team error and retries the team loader", async () => {
    teamState.error = new Error("failed")
    const { user } = renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />)
    expect(await screen.findByRole("heading", { name: "Could not load your teams" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: /no assignments/i })).not.toBeInTheDocument()
    const before = reloadTeams.mock.calls.length
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(reloadTeams).toHaveBeenCalledTimes(before + 1)
  })

  it("shows only the assignment error and retries assignments", async () => {
    teamState.teams = [{ id: 1, name: "Team", role: "admin", memberCount: 1 }]
    assignmentState.error = new Error("failed")
    const { user } = renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />)
    expect(await screen.findByRole("heading", { name: "Could not load assignments" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: /no assignments/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(reloadAssignments).toHaveBeenCalledOnce()
  })

  it("shows the current team instead of assignment creation controls for members", async () => {
    teamState.teams = [{ id: 1, name: "Research Team", role: "member", memberCount: 2 }]
    renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />)

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
    const { user } = renderWithRouter(<Dashboard user={{ id: "u1", email: "u@example.com", displayName: null }} onSignOut={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "Filter" }))
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
