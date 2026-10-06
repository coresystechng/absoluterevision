import { createRemoteJWKSet, jwtVerify } from "jose"
import { getHeader, HttpError, type ApiRequest } from "./http.js"

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/** Verify identity with Neon Auth rather than accepting a client-supplied user ID. */
export async function requireVerifiedUser(req: ApiRequest) {
  const authUrl = (process.env.NEON_AUTH_URL ?? process.env.VITE_NEON_AUTH_URL)?.replace(/\/$/, "")
  if (!authUrl) throw new HttpError(503, "Authentication is temporarily unavailable.")
  const token = getHeader(req.headers, "authorization")?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token) throw new HttpError(401, "Sign in to manage invitations.")
  let keys = keySets.get(authUrl)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${authUrl}/jwks`))
    keySets.set(authUrl, keys)
  }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer: authUrl, requiredClaims: ["sub", "exp"] })
    if (!payload.sub || typeof payload.email !== "string") throw new Error("Missing user identity")
    return { id: payload.sub, email: payload.email.trim().toLowerCase(), name: typeof payload.name === "string" ? payload.name : null }
  } catch {
    throw new HttpError(401, "Your session could not be verified. Sign in again.")
  }
}
