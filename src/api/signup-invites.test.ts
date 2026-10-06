import { afterEach, beforeEach, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({ token: vi.fn(), getSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getNeonAuthClient: () => auth }))
import { invitationAuthHeaders, redeemSignupInvite } from "./signup-invites"
import { createTeamSignupInvite, listTeamSignupInvites } from "./team-signup-invites"

beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

it("reads the signed JWT from the session instead of calling the SDK token endpoint", async () => {
  auth.getSession.mockResolvedValueOnce({ data: { session: { token: "fresh-jwt-1" } } }).mockResolvedValueOnce({ data: { session: { token: "fresh-jwt-2" } } })
  expect(await invitationAuthHeaders()).toMatchObject({ Authorization: "Bearer fresh-jwt-1" })
  expect(await invitationAuthHeaders()).toMatchObject({ Authorization: "Bearer fresh-jwt-2" })
  expect(auth.token).not.toHaveBeenCalled()
})
it("does not call invitation endpoints without an authenticated JWT", async () => {
  auth.getSession.mockResolvedValue({ data: null, error: { message: "Unauthorized" } })
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  await expect(createTeamSignupInvite(12, "new@example.com")).rejects.toThrow("Sign in")
  expect(fetchMock).not.toHaveBeenCalled()
})
it("authenticates listing, generation, and signup redemption with the session JWT", async () => {
  auth.getSession.mockResolvedValue({ data: { session: { token: "fresh-jwt" } } })
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ invites: [], token: "INV-ABCDEF-123456-7890AB", redeemed: true }) })
  vi.stubGlobal("fetch", fetchMock)
  await listTeamSignupInvites(12)
  await createTeamSignupInvite(12, "new@example.com")
  await redeemSignupInvite("INV-ABCDEF-123456-7890AB", "new@example.com", "receipt")
  expect(auth.getSession).toHaveBeenCalledTimes(3)
  for (const [, options] of fetchMock.mock.calls) expect(options.headers.Authorization).toBe("Bearer fresh-jwt")
})
