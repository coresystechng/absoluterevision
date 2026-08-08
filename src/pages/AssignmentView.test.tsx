import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import * as assignmentApi from "@/api/assignments"
import { AssignmentView } from "@/pages/AssignmentView"
import type { Assignment, AuthUser } from "@/types"

vi.mock("@/api/assignments", () => ({
  getById: vi.fn(), getActivities: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), updateProgressStage: vi.fn(), remove: vi.fn(),
}))
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn().mockResolvedValue({}) }))
vi.mock("@/hooks/useTeams", () => ({ useTeams: () => ({ members: [] }) }))
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }))
vi.mock("@/components/AssignmentFiles", () => ({ AssignmentFiles: () => <div>Files section</div> }))
vi.mock("@/components/AssignmentDialog", () => ({ AssignmentDialog: () => null }))
vi.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: ({ children }: { children: React.ReactNode }) => children }))

const getById = vi.mocked(assignmentApi.getById)
const getActivities = vi.mocked(assignmentApi.getActivities)
const user: AuthUser = { id: "user-1", email: "user@example.com", displayName: "User" }
const assignment: Assignment = {
  id: 42, trackingCode: "AR-902AF8:7A91F2-88C4D0-1B6E35", userId: user.id, teamId: 1, teamName: "Team",
  currentUserRole: "admin", assigneeUserId: user.id, assigneeName: "User", assigneeEmail: user.email,
  title: "Research brief", category: "Assignment", priority: "high", status: "ongoing", progressStage: "humaned",
  dueDate: "2026-09-01", dueTime: "12:00", progress: 30, notes: null,
  createdAt: "2026-08-01T10:00:00Z", updatedAt: "2026-08-01T10:00:00Z",
}

function renderView(path = "/assignments/42") {
  const router = createMemoryRouter([{ path: "/assignments/:id", element: <AssignmentView user={user} onSignOut={vi.fn()} /> }, { path: "/dashboard", element: <h1>Dashboard</h1> }], { initialEntries: [path] })
  return { router, ...render(<RouterProvider router={router} />) }
}

describe("AssignmentView load states", () => {
  beforeEach(() => { vi.clearAllMocks(); getActivities.mockResolvedValue([]) })

  it("shows loading then the privacy-safe not-found state only for a null result", async () => {
    let resolve!: (value: Assignment | null) => void
    getById.mockReturnValue(new Promise((done) => { resolve = done }))
    renderView()
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
    resolve(null)
    expect(await screen.findByRole("heading", { name: "Assignment not found" })).toBeVisible()
  })

  it("shows a retryable error for a rejected assignment request and recovers", async () => {
    getById.mockRejectedValueOnce(new Error("private server detail")).mockResolvedValueOnce(assignment)
    const { user: interaction } = await import("@testing-library/user-event").then(({ default: setup }) => ({ user: setup.setup() }))
    renderView()
    expect(await screen.findByRole("heading", { name: "Could not load this assignment" })).toBeVisible()
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument()
    await interaction.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { name: "Research brief" })).toBeVisible()
  })

  it("keeps the assignment usable when activity loading fails and retries activity", async () => {
    getById.mockResolvedValue(assignment)
    getActivities.mockRejectedValueOnce(new Error("activity failed")).mockResolvedValueOnce([])
    const { user: interaction } = await import("@testing-library/user-event").then(({ default: setup }) => ({ user: setup.setup() }))
    renderView()
    expect(await screen.findByRole("heading", { name: "Research brief" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Could not load activity" })).toBeVisible()
    await interaction.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText(/created the assignment/i)).toBeVisible()
  })

  it("ignores stale responses after the route id changes", async () => {
    let resolveOld!: (value: Assignment | null) => void
    getById.mockReturnValueOnce(new Promise((done) => { resolveOld = done })).mockResolvedValueOnce({ ...assignment, id: 43, title: "Current assignment" })
    const { router } = renderView()
    await router.navigate("/assignments/43")
    expect(await screen.findByRole("heading", { name: "Current assignment" })).toBeVisible()
    resolveOld({ ...assignment, title: "Stale assignment" })
    expect(screen.queryByRole("heading", { name: "Stale assignment" })).not.toBeInTheDocument()
  })
})
