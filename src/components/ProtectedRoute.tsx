import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { RoutePending } from "@/components/RoutePending"
import { getNeonAuthClient, isNeonAuthConfigured } from "@/lib/auth"
import type { AuthUser } from "@/types"

type ProtectedProps = { children: (user: AuthUser, signOut: () => Promise<void>) => ReactNode }

export function ProtectedRoute({ children }: ProtectedProps) {
  const location = useLocation()
  const from = `${location.pathname}${location.search}${location.hash}`
  if (!isNeonAuthConfigured) return <Navigate to="/login" replace state={{ from }} />
  return <ProtectedWithAuth>{children}</ProtectedWithAuth>
}

function ProtectedWithAuth({ children }: ProtectedProps) {
  const location = useLocation()
  const authClient = getNeonAuthClient()
  const session = authClient.useSession()
  if (session.isPending) return <RoutePending />
  if (!session.data) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  const user = session.data.user
  const authUser: AuthUser = { id: user.id, email: user.email, displayName: user.name ?? null }
  const signOut = async () => {
    await authClient.signOut()
    window.location.assign("/")
  }
  return <>{children(authUser, signOut)}</>
}
