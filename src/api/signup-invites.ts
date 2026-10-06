import { getNeonAuthClient } from "@/lib/auth"

export class SignupInviteError extends Error {}

export async function invitationAuthHeaders() {
  const session = await getNeonAuthClient().getSession()
  const token = session.data?.session.token
  if (!token) throw new SignupInviteError("Sign in to manage invitations.")
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

async function request(action: "reserve" | "redeem" | "release", input: { token: string; email: string; receipt?: string }) {
  const response = await fetch("/api/signup-invites", {
    method: "POST",
    headers: action === "redeem" ? await invitationAuthHeaders() : { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...input }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; receipt?: string }
  if (!response.ok) throw new SignupInviteError(payload.error ?? "Registration is temporarily unavailable.")
  return payload
}

export async function reserveSignupInvite(token: string, email: string) {
  const payload = await request("reserve", { token, email })
  if (!payload.receipt) throw new SignupInviteError("Registration is temporarily unavailable.")
  return payload.receipt
}

export async function redeemSignupInvite(token: string, email: string, receipt: string) {
  await request("redeem", { token, email, receipt })
}

export async function releaseSignupInvite(token: string, email: string, receipt: string) {
  await request("release", { token, email, receipt }).catch(() => undefined)
}
