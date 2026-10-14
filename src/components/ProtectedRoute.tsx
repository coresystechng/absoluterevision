import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { RoutePending } from "@/components/RoutePending"
import { getNeonAuthClient, isNeonAuthConfigured } from "@/lib/auth"
import type { AuthUser } from "@/types"
import { WorkspaceProvider } from "@/components/WorkspaceProvider"
import { disposeWorkspace, getWorkspaceGeneration, getWorkspaceSignOutOwner, getWorkspaceSignOutPending, isWorkspaceSignOutCurrent, setWorkspaceSignOutPending, subscribeWorkspace } from "@/lib/workspace-cache"

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
  const signingOut = useSyncExternalStore(subscribeWorkspace, getWorkspaceSignOutPending, getWorkspaceSignOutPending)
  useEffect(() => {
    if (!session.isPending && !session.data) disposeWorkspace()
    if (!session.isPending && session.data && getWorkspaceSignOutOwner() && getWorkspaceSignOutOwner() !== session.data.user.id) setWorkspaceSignOutPending(false)
  }, [session.isPending, session.data])
  if (signingOut) return <RoutePending />
  if (session.isPending) return <RoutePending />
  if (!session.data) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  const user = session.data.user
  const authUser: AuthUser = { id: user.id, email: user.email, displayName: user.name ?? null }
  const signOut = async () => {
    const token = setWorkspaceSignOutPending(true, authUser.id)
    disposeWorkspace(getWorkspaceGeneration())
    try {
      const result = await authClient.signOut()
      if (!isWorkspaceSignOutCurrent(token)) return
      if (result.error) throw new Error("Could not sign out. Try again.")
      window.location.assign("/")
    } catch (error) {
      if (!isWorkspaceSignOutCurrent(token)) return
      setWorkspaceSignOutPending(false)
      throw error
    }
  }
  return <WorkspaceProvider user={authUser}>{children(authUser, signOut)}</WorkspaceProvider>
}
