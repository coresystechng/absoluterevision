import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { Toaster } from "sonner"

import { ThemeProvider } from "@/hooks/useTheme"
import { RoutePending } from "@/components/RoutePending"
import { getNeonAuthClient, isNeonAuthConfigured } from "@/lib/auth"
import { AssignmentView } from "@/pages/AssignmentView"
import { AssignmentTracking } from "@/pages/AssignmentTracking"
import { Dashboard } from "@/pages/Dashboard"
import { DocumentUpload } from "@/pages/DocumentUpload"
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
  const location = useLocation()
  const from = `${location.pathname}${location.search}${location.hash}`
  if (!isNeonAuthConfigured) {
    return <Navigate to="/login" replace state={{ from }} />
  }

  return <ProtectedWithAuth>{children}</ProtectedWithAuth>
}

function ProtectedWithAuth({
  children,
}: {
  children: (user: AuthUser, signOut: () => Promise<void>) => React.ReactNode
}) {
  const location = useLocation()
  const authClient = getNeonAuthClient()
  const session = authClient.useSession()

  if (session.isPending) {
    return <RoutePending />
  }

  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
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
        <Route path="/document-upload" element={<DocumentUpload />} />
        <Route path="/track-assignment" element={<AssignmentTracking />} />
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
