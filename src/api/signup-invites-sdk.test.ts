import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"
import { afterEach, expect, it, vi } from "vitest"
import type { getNeonAuthClient } from "@/lib/auth"

const state = vi.hoisted(() => ({ client: null as ReturnType<typeof getNeonAuthClient> | null }))
vi.mock("@/lib/auth", () => ({ getNeonAuthClient: () => state.client }))
import { createTeamSignupInvite, listTeamSignupInvites } from "./team-signup-invites"

afterEach(() => { vi.unstubAllGlobals() })

it("lists and generates invitations using the installed Neon SDK with a populated session cache", async () => {
  const jwt = ["header", Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString("base64url"), "signature"].join(".")
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/get-session")) {
      return Response.json({
        session: { id: "session-id", token: "opaque-cookie-token", userId: "admin-id", expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
        user: { id: "admin-id", email: "admin@example.com", name: "Admin", emailVerified: true },
      }, { headers: { "set-auth-jwt": jwt } })
    }
    if (String(url) === "/api/team-signup-invites") {
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${jwt}`)
      const body = JSON.parse(String(init?.body))
      return Response.json(body.action === "list" ? { invites: [] } : { token: "INV-ABCDEF-123456-7890AB", email: body.email, expiresAt: "2026-10-13T00:00:00Z" })
    }
    throw new Error(`Unexpected request: ${String(url)}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  const client = createAuthClient("https://sdk-regression.example/neondb/auth", { adapter: BetterAuthReactAdapter() })
  state.client = client
  const session = await client.getSession()
  expect(session.data?.session.token).toBe(jwt)
  await expect(listTeamSignupInvites(12)).resolves.toEqual({ invites: [] })
  await expect(createTeamSignupInvite(12, "new@example.com")).resolves.toMatchObject({ token: "INV-ABCDEF-123456-7890AB" })
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/get-session"))).toHaveLength(1)
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/token"))).toHaveLength(0)
})
