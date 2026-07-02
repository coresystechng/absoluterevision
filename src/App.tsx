import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"

import { ThemeProvider } from "@/hooks/useTheme"
import { getNeonAuthClient, isNeonAuthConfigured } from "@/lib/auth"
import { AssignmentView } from "@/pages/AssignmentView"
import { Dashboard } from "@/pages/Dashboard"
import { Landing } from "@/pages/Landing"
import { Login } from "@/pages/Login"
import { Settings } from "@/pages/Settings"
import type { AuthUser } from "@/types"

type NeonSessionUser = {
  id: string
  email: string
  name?: string | null
}

function toAuthUser(user: NeonSessionUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.name ?? null,
  }
}

function Protected({
  children,
}: {
  children: (user: AuthUser, signOut: () => Promise<void>) => React.ReactNode
}) {
  if (!isNeonAuthConfigured) {
    return <Navigate to="/login" replace />
  }

  return <ProtectedWithAuth>{children}</ProtectedWithAuth>
}

function ProtectedWithAuth({
  children,
}: {
  children: (user: AuthUser, signOut: () => Promise<void>) => React.ReactNode
}) {
  const authClient = getNeonAuthClient()
  const session = authClient.useSession()

  if (session.isPending) {
    return null
  }

  if (!session.data) {
    return <Navigate to="/login" replace />
  }

  const authUser = toAuthUser(session.data.user)
  const signOut = async () => {
    await authClient.signOut()
    window.location.assign("/")
  }

  return <>{children(authUser, signOut)}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/sign-in" element={<Login />} />
        <Route path="/sign-up" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              {(user, signOut) => <Dashboard user={user} onSignOut={signOut} />}
            </Protected>
          }
        />
        <Route
          path="/assignments/:id"
          element={
            <Protected>
              {(user, signOut) => <AssignmentView user={user} onSignOut={signOut} />}
            </Protected>
          }
        />
        <Route
          path="/settings"
          element={
            <Protected>
              {(user, signOut) => <Settings user={user} onSignOut={signOut} />}
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors closeButton />
    </ThemeProvider>
  )
}
