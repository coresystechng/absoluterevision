import { act, render, screen, waitFor } from "@testing-library/react"
import { Link, MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getOrCreateUser } from "@/api/users"
import { disposeWorkspace, getWorkspaceGeneration, setWorkspaceSignOutPending } from "@/lib/workspace-cache"
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn(async (user) => ({ ...user, activeTeamId: 1, dashboardFilters: { types: [], priorities: [], statuses: [] }, createdAt: "2026-01-01" })) }))

const { sdkSignOut } = vi.hoisted(() => ({ sdkSignOut: vi.fn() }))
let session: { isPending: boolean; data: { user: { id: string; email: string; name: string } } | null }

vi.mock("@/lib/auth", () => ({
  isNeonAuthConfigured: true,
  getNeonAuthClient: () => ({
    useSession: () => session,
    signOut: sdkSignOut,
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  }),
}))
vi.mock("@/pages/Dashboard", () => ({ Dashboard: ({ onSignOut }: { onSignOut: () => Promise<void> }) => <><h1>Dashboard route</h1><button onClick={() => { void onSignOut().catch(() => undefined) }}>Sign out</button><Link to="/assignments/42">Detail</Link></> }))
vi.mock("@/pages/AssignmentView", () => ({ AssignmentView: () => <h1>Assignment route</h1> }))

import App from "@/App"

describe("App authentication states", () => {
  beforeEach(() => { setWorkspaceSignOutPending(false); disposeWorkspace(); sdkSignOut.mockReset(); vi.mocked(getOrCreateUser).mockClear(); session = { isPending: false, data: null } })

  it("shows a branded pending route while the session resolves", () => {
    session.isPending = true
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    expect(screen.getByRole("status")).toHaveTextContent("Loading your workspace")
  })

  it("redirects an unauthenticated deep link to login", async () => {
    render(<MemoryRouter initialEntries={["/assignments/42?view=activity"]}><App /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible()
  })

  it("renders authenticated protected content", async () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Dashboard route" })).toBeVisible()
  })

  it("returns authenticated users to a safe internal destination", async () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    render(<MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/assignments/42" } }]}><App /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Assignment route" })).toBeVisible()
  })

  it("falls back to dashboard for a protocol-relative destination", async () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    render(<MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "//evil.example" } }]}><App /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Dashboard route" })).toBeVisible()
  })

  it.each(["reject", "resolved-error"])("restores a new generation after SDK sign-out %s", async (mode) => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    const interaction = (await import("@testing-library/user-event")).default.setup()
    if (mode === "reject") sdkSignOut.mockRejectedValue(new Error("Failed"))
    else sdkSignOut.mockResolvedValue({ error: { message: "Failed" } })
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    await screen.findByRole("heading", { name: "Dashboard route" })
    const first = getWorkspaceGeneration()!
    await interaction.click(screen.getByRole("button", { name: "Sign out" }))
    await screen.findByRole("heading", { name: "Dashboard route" })
    expect(getWorkspaceGeneration()!.generation).toBeGreaterThan(first.generation)
    expect(first.client.getQueryCache().getAll()).toHaveLength(0)
    expect(getOrCreateUser).toHaveBeenCalledTimes(2)
  })

  it("keeps private state disposed during a deferred sign-out and route remount", async () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    let reject!: (error: Error) => void
    sdkSignOut.mockReturnValue(new Promise((_done, fail) => { reject = fail }))
    const interaction = (await import("@testing-library/user-event")).default.setup()
    const first = render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    await screen.findByRole("heading", { name: "Dashboard route" })
    await interaction.click(screen.getByRole("button", { name: "Sign out" }))
    first.unmount()
    render(<MemoryRouter initialEntries={["/assignments/42"]}><App /></MemoryRouter>)
    expect(screen.queryByRole("heading", { name: "Assignment route" })).not.toBeInTheDocument()
    expect(getWorkspaceGeneration()).toBeNull()
    expect(getOrCreateUser).toHaveBeenCalledTimes(1)
    await act(async () => reject(new Error("Failed")))
    expect(await screen.findByRole("heading", { name: "Assignment route" })).toBeVisible()
  })

  it("renders a new account while the old account sign-out is unresolved", async () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    let resolve!: (value: { error: null }) => void
    sdkSignOut.mockReturnValue(new Promise((done) => { resolve = done }))
    const interaction = (await import("@testing-library/user-event")).default.setup()
    const { rerender } = render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    await screen.findByRole("heading", { name: "Dashboard route" })
    await interaction.click(screen.getByRole("button", { name: "Sign out" }))
    session.data = { user: { id: "user-2", email: "other@example.com", name: "Other" } }
    rerender(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    await screen.findByRole("heading", { name: "Dashboard route" })
    const next = getWorkspaceGeneration()
    expect(next?.userId).toBe("user-2")
    await act(async () => resolve({ error: null }))
    expect(getWorkspaceGeneration()).toBe(next)
    expect(screen.getByRole("heading", { name: "Dashboard route" })).toBeVisible()
  })

  it("preserves the client while session is pending, then disposes it on resolved loss", async () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    const app = <MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>
    const { rerender } = render(app)
    await screen.findByRole("heading", { name: "Dashboard route" })
    const first = getWorkspaceGeneration()
    session = { isPending: true, data: null }
    rerender(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    expect(getWorkspaceGeneration()).toBe(first)
    session = { isPending: false, data: null }
    rerender(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    await screen.findByRole("heading", { name: "Sign in" })
    await waitFor(() => expect(getWorkspaceGeneration()).toBeNull())
  })

  it("renders a not-found page rather than redirecting an unknown URL home", () => {
    render(<MemoryRouter initialEntries={["/missing-page"]}><App /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "We couldn't find that page." })).toBeVisible()
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/")
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
  })
})
