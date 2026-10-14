import { StrictMode } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getOrCreateUser } from "@/api/users"
import { WorkspaceProvider } from "./WorkspaceProvider"
import { useWorkspace } from "@/hooks/useWorkspace"
import { disposeWorkspace } from "@/lib/workspace-cache"
import type { UserProfile } from "@/types"
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn() }))
const user = { id: "A", email: "a@example.com", displayName: "Alice" }
const profile: UserProfile = { ...user, activeTeamId: 1, dashboardFilters: { types: [], priorities: [], statuses: [] }, createdAt: "2026-01-01" }
function Consumer() { const { profile } = useWorkspace(); return <h1>{profile.displayName}</h1> }
beforeEach(() => { disposeWorkspace(); vi.mocked(getOrCreateUser).mockReset(); vi.mocked(getOrCreateUser).mockResolvedValue(profile) })
afterEach(() => disposeWorkspace())
it("bootstraps once through StrictMode and a same-user remount", async () => {
  const first = render(<StrictMode><WorkspaceProvider user={user}><Consumer /></WorkspaceProvider></StrictMode>)
  expect(await screen.findByRole("heading", { name: "Alice" })).toBeVisible()
  first.unmount()
  render(<WorkspaceProvider user={user}><Consumer /></WorkspaceProvider>)
  expect(await screen.findByRole("heading", { name: "Alice" })).toBeVisible()
  expect(getOrCreateUser).toHaveBeenCalledTimes(1)
})
it("reuses unfinished provisioning after generation disposal", async () => {
  let resolve!: (value: UserProfile) => void
  vi.mocked(getOrCreateUser).mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const first = render(<WorkspaceProvider user={user}><Consumer /></WorkspaceProvider>)
  first.unmount()
  act(() => disposeWorkspace())
  render(<WorkspaceProvider user={user}><Consumer /></WorkspaceProvider>)
  await act(async () => resolve(profile))
  expect(await screen.findByRole("heading", { name: "Alice" })).toBeVisible()
  expect(getOrCreateUser).toHaveBeenCalledTimes(1)
})

it("holds dependent list reads until bootstrap and isolates delayed old-account completion", async () => {
  let resolveA!: (value: UserProfile) => void
  vi.mocked(getOrCreateUser).mockReturnValueOnce(new Promise((done) => { resolveA = done })).mockResolvedValueOnce({ ...profile, id: "B", displayName: "Bob" })
  const view = render(<WorkspaceProvider user={user}><Consumer /></WorkspaceProvider>)
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  view.rerender(<WorkspaceProvider user={{ ...user, id: "B" }}><Consumer /></WorkspaceProvider>)
  expect(await screen.findByRole("heading", { name: "Bob" })).toBeVisible()
  await act(async () => resolveA(profile))
  expect(screen.queryByRole("heading", { name: "Alice" })).not.toBeInTheDocument()
  expect(getOrCreateUser).toHaveBeenCalledTimes(2)
})
it("offers an explicit bootstrap retry without automatic reprovisioning", async () => {
  vi.mocked(getOrCreateUser).mockRejectedValueOnce(new Error("Private SQL details")).mockResolvedValueOnce(profile)
  render(<WorkspaceProvider user={user}><Consumer /></WorkspaceProvider>)
  await screen.findByRole("heading", { name: "Could not initialize your workspace" })
  expect(screen.queryByText("Private SQL details")).not.toBeInTheDocument()
  expect(getOrCreateUser).toHaveBeenCalledTimes(1)
  screen.getByRole("button", { name: "Try again" }).click()
  await waitFor(() => expect(screen.getByRole("heading", { name: "Alice" })).toBeVisible())
  expect(getOrCreateUser).toHaveBeenCalledTimes(2)
})
