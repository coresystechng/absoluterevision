import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { SignupInvitations } from "./SignupInvitations"

const api = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), revoke: vi.fn() }))
vi.mock("@/api/team-signup-invites", () => ({ createTeamSignupInvite: api.create, listTeamSignupInvites: api.list, revokeTeamSignupInvite: api.revoke }))

beforeEach(() => {
  vi.resetAllMocks()
  api.list.mockResolvedValue({ invites: [] })
})

it("generates a recipient-bound code for the selected team and prepares a sharing draft", async () => {
  api.create.mockResolvedValue({ token: "INV-ABCDEF-123456-7890AB", email: "new@example.com", expiresAt: "2026-10-13T00:00:00Z" })
  render(<SignupInvitations teamId={12} teamName="Research team" />)
  fireEvent.change(screen.getByLabelText("New user's email"), { target: { value: "new@example.com" } })
  fireEvent.click(screen.getByRole("button", { name: "Generate access token" }))
  await waitFor(() => expect(api.create).toHaveBeenCalledWith(12, "new@example.com"))
  expect(await screen.findByDisplayValue("INV-ABCDEF-123456-7890AB")).toBeVisible()
  const draft = screen.getByRole("link", { name: "Open email draft" }).getAttribute("href")!
  expect(decodeURIComponent(draft)).toContain("mailto:new@example.com")
  expect(decodeURIComponent(draft)).toContain("You'll automatically join Research team")
})

it("allows pending invitations to be revoked", async () => {
  api.list.mockResolvedValue({ invites: [{ id: "5", email: "new@example.com", expiresAt: "2026-10-13T00:00:00Z", status: "pending" }] })
  api.revoke.mockResolvedValue({ revoked: true })
  render(<SignupInvitations teamId={12} teamName="Research team" />)
  fireEvent.click(await screen.findByRole("button", { name: "Revoke invitation for new@example.com" }))
  await waitFor(() => expect(api.revoke).toHaveBeenCalledWith(12, "5"))
  expect(await screen.findByText("revoked")).toBeVisible()
})
