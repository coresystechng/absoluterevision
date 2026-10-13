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

  it("renders a not-found page rather than redirecting an unknown URL home", () => {
    render(<MemoryRouter initialEntries={["/missing-page"]}><App /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "We couldn't find that page." })).toBeVisible()
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/")
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
  })
})
