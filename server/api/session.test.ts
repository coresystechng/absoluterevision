import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiRequest } from "./http.js"

const mocks = vi.hoisted(() => ({ verify: vi.fn() }))
vi.mock("jose", () => ({ createRemoteJWKSet: vi.fn(() => "keys"), jwtVerify: mocks.verify }))
import { requireVerifiedUser } from "./session.js"

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("NEON_AUTH_URL", "https://auth.example.com/auth")
})

describe("invitation authentication", () => {
  it("rejects a forged user ID header without a bearer token", async () => {
    await expect(requireVerifiedUser({ headers: { "x-absolute-revision-user-id": "admin" } } as unknown as ApiRequest)).rejects.toThrow("Sign in")
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it("requires a valid signed token from the configured issuer", async () => {
    mocks.verify.mockRejectedValue(new Error("invalid signature"))
    await expect(requireVerifiedUser({ headers: { authorization: "Bearer forged" } } as ApiRequest)).rejects.toThrow("could not be verified")
  })
  it("uses the verified identity and normalizes the email", async () => {
    mocks.verify.mockResolvedValue({ payload: { sub: "admin-id", email: "Admin@Example.com", name: "Admin" } })
    await expect(requireVerifiedUser({ headers: { authorization: "Bearer valid" } } as ApiRequest)).resolves.toEqual({ id: "admin-id", email: "admin@example.com", name: "Admin" })
    expect(mocks.verify).toHaveBeenCalledWith("valid", expect.anything(), { issuer: "https://auth.example.com/auth", requiredClaims: ["sub", "exp"] })
  })
})
