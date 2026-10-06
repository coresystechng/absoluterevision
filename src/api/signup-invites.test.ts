import { afterEach, beforeEach, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({ token: vi.fn(), getSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getNeonAuthClient: () => auth }))
import { invitationAuthHeaders, redeemSignupInvite } from "./signup-invites"
import { createTeamSignupInvite, listTeamSignupInvites } from "./team-signup-invites"

beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

it("requests a fresh JWT for each invitation call without using cached session tokens", async () => {
  auth.token.mockResolvedValueOnce({ data: { token: "fresh-jwt-1" } }).mockResolvedValueOnce({ data: { token: "fresh-jwt-2" } })
  expect(await invitationAuthHeaders()).toMatchObject({ Authorization: "Bearer fresh-jwt-1" })
  expect(await invitationAuthHeaders()).toMatchObject({ Authorization: "Bearer fresh-jwt-2" })
  expect(auth.getSession).not.toHaveBeenCalled()
})
it("does not call invitation endpoints without an authenticated JWT", async () => {
  auth.token.mockResolvedValue({ data: null, error: { message: "Unauthorized" } })
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  await expect(createTeamSignupInvite(12, "new@example.com")).rejects.toThrow("Sign in")
  expect(fetchMock).not.toHaveBeenCalled()
})
it("authenticates listing, generation, and signup redemption with a fresh JWT", async () => {
  auth.token.mockResolvedValue({ data: { token: "fresh-jwt" } })
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ invites: [], token: "INV-ABCDEF-123456-7890AB", redeemed: true }) })
  vi.stubGlobal("fetch", fetchMock)
  await listTeamSignupInvites(12)
  await createTeamSignupInvite(12, "new@example.com")
  await redeemSignupInvite("INV-ABCDEF-123456-7890AB", "new@example.com", "receipt")
  expect(auth.token).toHaveBeenCalledTimes(3)
  for (const [, options] of fetchMock.mock.calls) expect(options.headers.Authorization).toBe("Bearer fresh-jwt")
})
