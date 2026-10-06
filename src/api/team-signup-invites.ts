import { invitationAuthHeaders, SignupInviteError } from "./signup-invites"

export type TeamSignupInvite = { id: string; email: string; expiresAt: string; status: "pending" | "used" | "expired" | "revoked" }
export type GeneratedSignupInvite = { token: string; email: string; expiresAt: string }

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/team-signup-invites", { method: "POST", headers: await invitationAuthHeaders(), body: JSON.stringify(body) })
  const payload = await response.json()
  if (!response.ok) throw new SignupInviteError(payload.error ?? "Could not manage invitations.")
  return payload as T
}
export const createTeamSignupInvite = (teamId: number, email: string) => request<GeneratedSignupInvite>({ action: "create", teamId, email })
export const listTeamSignupInvites = (teamId: number) => request<{ invites: TeamSignupInvite[] }>({ action: "list", teamId })
export const revokeTeamSignupInvite = (teamId: number, inviteId: string) => request({ action: "revoke", teamId, inviteId })
