import { useState } from "react"
import { Navigate, Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getNeonAuthClient, isNeonAuthConfigured } from "@/lib/auth"

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
            <img src="/img/logo.png" alt="" className="h-7 w-7 object-contain" />
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (session.data) {
    return <Navigate to="/dashboard" replace />
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0] || "New user",
          callbackURL: "/dashboard",
        })
      } else {
        await authClient.signIn.email({
          email,
          password,
          callbackURL: "/dashboard",
        })
      }

      window.location.assign("/dashboard")
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Button variant="ghost" asChild className="mx-auto mb-5 flex h-auto w-fit px-0">
          <Link to="/" className="flex items-center gap-2">
            <img src="/img/logo.png" alt="" className="h-7 w-7 object-contain" />
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

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
              <Link className="font-medium text-foreground underline underline-offset-4" to={isSignUp ? "/sign-in" : "/sign-up"}>
                {isSignUp ? "Sign in" : "Sign up"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
