import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Dashboard } from "@/pages/Dashboard"
import { renderWithRouter } from "@/test/render"

const reloadTeams = vi.fn().mockResolvedValue(undefined)
const reloadAssignments = vi.fn().mockResolvedValue(undefined)
let teamState: Record<string, unknown>
let assignmentState: Record<string, unknown>

vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn().mockResolvedValue({ dashboardFilters: { type: "all", priority: "all", status: "all" }, activeTeamId: null }) }))
vi.mock("@/hooks/useTeams", () => ({ useTeams: () => teamState }))
vi.mock("@/hooks/useAssignments", () => ({ useAssignments: () => assignmentState }))
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }))
vi.mock("@/components/AssignmentDialog", () => ({ AssignmentDialog: () => null }))
vi.mock("@/components/AssignmentCard", () => ({ AssignmentCard: () => <article>Assignment card</article> }))

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
})
