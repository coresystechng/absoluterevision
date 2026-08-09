import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

let session: { isPending: boolean; data: { user: { id: string; email: string; name: string } } | null }

vi.mock("@/lib/auth", () => ({
  isNeonAuthConfigured: true,
  getNeonAuthClient: () => ({
    useSession: () => session,
    signOut: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  }),
}))
vi.mock("@/pages/Dashboard", () => ({ Dashboard: () => <h1>Dashboard route</h1> }))
vi.mock("@/pages/AssignmentView", () => ({ AssignmentView: () => <h1>Assignment route</h1> }))

import App from "@/App"

describe("App authentication states", () => {
  beforeEach(() => { session = { isPending: false, data: null } })

  it("shows a branded pending route while the session resolves", () => {
    session.isPending = true
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    expect(screen.getByRole("status")).toHaveTextContent("Loading your workspace")
  })

  it("redirects an unauthenticated deep link to login", () => {
    render(<MemoryRouter initialEntries={["/assignments/42?view=activity"]}><App /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible()
  })

  it("renders authenticated protected content", () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    render(<MemoryRouter initialEntries={["/dashboard"]}><App /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Dashboard route" })).toBeVisible()
  })

  it("returns authenticated users to a safe internal destination", () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    render(<MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/assignments/42" } }]}><App /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Assignment route" })).toBeVisible()
  })

  it("falls back to dashboard for a protocol-relative destination", () => {
    session.data = { user: { id: "user-1", email: "user@example.com", name: "User" } }
    render(<MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "//evil.example" } }]}><App /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Dashboard route" })).toBeVisible()
  })
})
