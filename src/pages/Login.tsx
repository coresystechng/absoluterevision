import { useState } from "react"
import { Navigate, Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { redeemSignupInvite, releaseSignupInvite, reserveSignupInvite, SignupInviteError } from "@/api/signup-invites"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getNeonAuthClient, isNeonAuthConfigured } from "@/lib/auth"
import { RoutePending } from "@/components/RoutePending"

import logoImage from "../../img/icon.png"

export function Login() {
  if (!isNeonAuthConfigured) {
    return <LoginConfigurationMissing />
  }

  return <LoginForm />
}

function LoginConfigurationMissing() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Button variant="ghost" asChild className="mx-auto mb-5 flex h-auto w-fit px-0">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImage} alt="" className="h-7 w-7 object-contain" />
            <span>Absolute Revision</span>
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Authentication is not configured</CardTitle>
            <CardDescription>
              Add your Neon Auth URL to `.env.local` before signing in.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <code>VITE_NEON_AUTH_URL</code>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function LoginForm() {
  const authClient = getNeonAuthClient()
  const session = authClient.useSession()
  const location = useLocation()
  const isSignUp = location.pathname === "/sign-up"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState("")
  const requestedDestination = (location.state as { from?: unknown } | null)?.from
  const destination = typeof requestedDestination === "string" && requestedDestination.startsWith("/") && !requestedDestination.startsWith("//")
    ? requestedDestination
    : "/dashboard"

  if (session.isPending) {
    return <RoutePending label="Checking your session" />
  }

  if (session.data) {
    return <Navigate to={destination} replace />
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        if (!accessToken.trim()) {
          setInviteMessage("Registration is currently private. Ask the Absolute Revision team for a one-time access token, then enter it here to create your account.")
          return
        }
        const receipt = await reserveSignupInvite(accessToken, email)
        let accountCreated = false
        try {
          await authClient.signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "New user",
            callbackURL: destination,
          })
          accountCreated = true
          await redeemSignupInvite(accessToken, email, receipt)
        } catch (error) {
          if (accountCreated) await authClient.signOut().catch(() => undefined)
          await releaseSignupInvite(accessToken, email, receipt)
          throw error
        }
      } else {
        await authClient.signIn.email({
          email,
          password,
          callbackURL: destination,
        })
      }

      window.location.assign(destination)
    } catch (error) {
      if (error instanceof SignupInviteError) {
        setInviteMessage(error.message)
      } else {
        toast.error("Something went wrong. Try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Button variant="ghost" asChild className="mx-auto mb-5 flex h-auto w-fit px-0">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImage} alt="" className="h-7 w-7 object-contain" />
            <span>Absolute Revision</span>
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{isSignUp ? "Create your account" : "Sign in"}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "Start tracking assignments and revision work."
                : "Enter your email and password to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              {isSignUp ? (
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {isSignUp ? (
                <div className="grid gap-2">
                  <Label htmlFor="access-token">Access token</Label>
                  <Input
                    id="access-token"
                    value={accessToken}
                    onChange={(event) => setAccessToken(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="INV-XXXXXX-XXXXXX-XXXXXX"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Registration is invite-only. Contact our team if you have been approved but have not received a token.</p>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                />
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
              </Button>
            </form>

            {isSignUp ? <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account?{" "}<Link className="font-medium text-foreground underline underline-offset-4" to="/sign-in">Sign in</Link></p> : null}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={Boolean(inviteMessage)} onOpenChange={(open) => { if (!open) setInviteMessage("") }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Private registration</AlertDialogTitle>
            <AlertDialogDescription>{inviteMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Button asChild><a href="mailto:support@absoluterevision.com?subject=Private%20account%20access">Request access</a></Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
