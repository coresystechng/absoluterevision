import { createAuthClient } from "@neondatabase/neon-js/auth"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

export const isNeonAuthConfigured = Boolean(authUrl)

export const neonAuthClient = isNeonAuthConfigured
  ? createAuthClient(authUrl, {
      adapter: BetterAuthReactAdapter(),
    })
  : null

export function getNeonAuthClient() {
  if (!neonAuthClient) {
    throw new Error("Missing VITE_NEON_AUTH_URL")
  }
  return neonAuthClient
}
