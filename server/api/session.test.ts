import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest"
import { requireVerifiedUser } from "./session.js"
import type { ApiRequest, ApiResponse } from "./http.js"
import teamInvitesHandler from "../../api/team-signup-invites.js"

const db = vi.hoisted(() => ({ initFilesDb: vi.fn(), query: vi.fn() }))
vi.mock("./db.js", () => db)

let server: Server
let origin: string
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"]
const requestedPaths: string[] = []

beforeAll(async () => {
  const keys = await generateKeyPair("EdDSA")
  privateKey = keys.privateKey
  const publicKey = { ...await exportJWK(keys.publicKey), kid: "neon-test-key", alg: "EdDSA" }
  server = createServer((req, res) => {
    requestedPaths.push(req.url ?? "")
    res.setHeader("Content-Type", "application/json")
    if (req.url === "/neondb/auth/.well-known/jwks.json") {
      res.end(JSON.stringify({ keys: [publicKey] }))
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ error: "Not found" }))
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function signedToken(issuer = origin, audience = origin, expiry: number | string = "15m") {
  return new SignJWT({ email: "Admin@Example.com", name: "Admin" })
    .setProtectedHeader({ alg: "EdDSA", kid: "neon-test-key" })
    .setSubject("admin-id").setIssuedAt().setExpirationTime(expiry)
    .setIssuer(issuer).setAudience(audience).sign(privateKey)
}

function request(token?: string) {
  return { headers: token ? { authorization: `Bearer ${token}` } : { "x-absolute-revision-user-id": "admin" } } as unknown as ApiRequest
}

describe("invitation authentication with signed Neon-format JWTs", () => {
  it("fetches the actual JWKS path and accepts origin issuer/audience with an auth URL path", async () => {
    vi.stubEnv("NEON_AUTH_URL", `${origin}/neondb/auth/`)
    await expect(requireVerifiedUser(request(await signedToken()))).resolves.toEqual({ id: "admin-id", email: "admin@example.com", name: "Admin" })
    expect(requestedPaths).toContain("/neondb/auth/.well-known/jwks.json")
    expect(requestedPaths).not.toContain("/neondb/auth/jwks")
  })
  it("supports the existing VITE_NEON_AUTH_URL fallback", async () => {
    vi.stubEnv("NEON_AUTH_URL", undefined)
    vi.stubEnv("VITE_NEON_AUTH_URL", `${origin}/neondb/auth`)
    await expect(requireVerifiedUser(request(await signedToken()))).resolves.toMatchObject({ id: "admin-id" })
  })
  it("rejects forged user IDs without a bearer token", async () => {
    vi.stubEnv("NEON_AUTH_URL", `${origin}/neondb/auth`)
    await expect(requireVerifiedUser(request())).rejects.toMatchObject({ statusCode: 401 })
  })
  it("rejects wrong issuers, audiences, expired JWTs and opaque session tokens", async () => {
    vi.stubEnv("NEON_AUTH_URL", `${origin}/neondb/auth`)
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const tokens = [await signedToken("https://attacker.example"), await signedToken(origin, "https://attacker.example"), await signedToken(origin, origin, 1), "opaque-session-token"]
    for (const token of tokens) {
      await expect(requireVerifiedUser(request(token))).rejects.toMatchObject({ statusCode: 401 })
      expect(JSON.stringify(log.mock.calls)).not.toContain(token)
    }
  })
  it("reports unavailable public keys as a service failure rather than an expired session", async () => {
    vi.stubEnv("NEON_AUTH_URL", `${origin}/missing-auth`)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    await expect(requireVerifiedUser(request(await signedToken()))).rejects.toMatchObject({ statusCode: 503 })
  })
  it("generates a team access token through the API using a signed admin JWT", async () => {
    vi.stubEnv("NEON_AUTH_URL", `${origin}/neondb/auth`)
    db.initFilesDb.mockResolvedValue(undefined)
    db.query.mockReset().mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: "2", expires_at: "2026-10-13T00:00:00Z" }])
    const req = Object.assign(request(await signedToken()), { method: "POST", body: { action: "create", teamId: 12, email: "new@example.com" } })
    const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }
    res.status.mockReturnValue(res)
    await teamInvitesHandler(req, res as unknown as ApiResponse)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ token: expect.stringMatching(/^INV-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/), email: "new@example.com", expiresAt: "2026-10-13T00:00:00Z" })
    expect(db.query.mock.calls[0][1]).toEqual(["admin-id", 12])
    expect(db.query.mock.calls[1][1]).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/), 12, "admin-id", "new@example.com"])
  })
})
