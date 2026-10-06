import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createTeamSignupInvite, listTeamSignupInvites, revokeTeamSignupInvite, type GeneratedSignupInvite, type TeamSignupInvite } from "@/api/team-signup-invites"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export function SignupInvitations({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [email, setEmail] = useState("")
  const [generated, setGenerated] = useState<GeneratedSignupInvite | null>(null)
  const [invites, setInvites] = useState<TeamSignupInvite[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listTeamSignupInvites(teamId).then(({ invites: rows }) => { if (!cancelled) setInvites(rows) })
      .catch(() => { if (!cancelled) setError("Could not load invitations.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId])

  async function generate(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const invitation = await createTeamSignupInvite(teamId, email)
      setGenerated(invitation)
      setEmail("")
      toast.success("Access token generated")
      const result = await listTeamSignupInvites(teamId)
      setInvites(result.invites)
    } catch (error) { setError(error instanceof Error ? error.message : "Could not generate an access token.") }
    finally { setPending(false) }
  }

  async function revoke(id: string) {
    setPending(true)
    setError("")
    try {
      await revokeTeamSignupInvite(teamId, id)
      setInvites((rows) => rows.map((row) => row.id === id ? { ...row, status: "revoked" } : row))
      toast.success("Invitation revoked")
    } catch (error) { setError(error instanceof Error ? error.message : "Could not revoke invitation.") }
    finally { setPending(false) }
  }

  const signupUrl = `${window.location.origin}/sign-up`
  const message = generated ? `You're invited to join ${teamName} on Absolute Revision.\n\nCreate your account at ${signupUrl}\nEmail: ${generated.email}\nAccess token: ${generated.token}\n\nThis token expires ${new Date(generated.expiresAt).toLocaleDateString()} and can be used once. You'll automatically join ${teamName}.` : ""

  return (
    <section className="grid gap-4" aria-labelledby="signup-invitations-heading">
      <div>
        <h3 id="signup-invitations-heading" className="font-medium">Invite new users</h3>
        <p className="mt-1 text-sm text-muted-foreground">Generate a one-time access token for someone creating their first account. They will join {teamName} as a member.</p>
      </div>
      <form onSubmit={generate} className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="signup-invite-email">New user's email</Label>
          <Input id="signup-invite-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="newuser@example.com" />
        </div>
        <Button disabled={pending} type="submit">{pending ? "Please wait..." : "Generate access token"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">Tokens are tied to this email and expire after seven days. Existing users can join through Add member below.</p>
      {generated ? (
        <div className="grid gap-3 rounded-lg border p-4" role="status">
          <p className="text-sm">Access token for <strong>{generated.email}</strong></p>
          <Input aria-label="Generated access token" readOnly value={generated.token} className="font-mono" onFocus={(event) => event.target.select()} />
          <p className="text-xs text-muted-foreground">Expires {new Date(generated.expiresAt).toLocaleDateString()}. Copy this token now; it cannot be retrieved later.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(message).then(() => toast.success("Invitation copied")).catch(() => toast.error("Could not copy. Select and copy the token above.")) }}>Copy invitation</Button>
            <Button asChild><a href={`mailto:${encodeURIComponent(generated.email)}?subject=${encodeURIComponent(`Join ${teamName} on Absolute Revision`)}&body=${encodeURIComponent(message)}`}>Open email draft</a></Button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading invitations...</p> : invites.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {invites.map((invite) => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0"><p className="break-all text-sm">{invite.email}</p><p className="text-xs text-muted-foreground">Expires {new Date(invite.expiresAt).toLocaleDateString()}</p></div>
            <div className="flex items-center gap-2"><Badge variant="secondary">{invite.status}</Badge>{invite.status === "pending" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => void revoke(invite.id)} aria-label={`Revoke invitation for ${invite.email}`}>Revoke</Button> : null}</div>
          </li>)}
        </ul>
      ) : null}
    </section>
  )
}
