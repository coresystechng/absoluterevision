import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { QueryClientProvider, useQuery } from "@tanstack/react-query"
import { RoutePending } from "@/components/RoutePending"
import { StatePanel } from "@/components/StatePanel"
import { WorkspaceContext } from "@/hooks/useWorkspace"
import { acquireWorkspace, getWorkspaceGeneration, getWorkspaceSignOutPending, isWorkspaceCurrent, provisionWorkspace, subscribeWorkspace, workspaceKeys, type WorkspaceGeneration } from "@/lib/workspace-cache"
import type { AuthUser } from "@/types"

export function WorkspaceProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const identity = useSyncExternalStore(subscribeWorkspace, getWorkspaceGeneration, getWorkspaceGeneration)
  const signingOut = useSyncExternalStore(subscribeWorkspace, getWorkspaceSignOutPending, getWorkspaceSignOutPending)
  useEffect(() => { if (!getWorkspaceSignOutPending()) acquireWorkspace(user.id) }, [user.id])
  useEffect(() => { if (!identity && !signingOut) acquireWorkspace(user.id) }, [identity, signingOut, user.id])
  if (signingOut || !identity || identity.userId !== user.id) return <RoutePending />
  return <QueryClientProvider client={identity.client}><WorkspaceBootstrap key={identity.generation} user={user} identity={identity}>{children}</WorkspaceBootstrap></QueryClientProvider>
}

function WorkspaceBootstrap({ user, identity, children }: { user: AuthUser; identity: WorkspaceGeneration; children: ReactNode }) {
  const profile = useQuery({ queryKey: workspaceKeys.profile(user.id), queryFn: () => provisionWorkspace(user), staleTime: Infinity, gcTime: Infinity, retry: false, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false })
  if (profile.isError) return <StatePanel context="page" tone="error" title="Could not initialize your workspace" description="Please try again." primaryAction={{ label: "Try again", onClick: () => { void profile.refetch() } }} live="assertive" />
  if (!profile.data) return <RoutePending />
  return <WorkspaceContext.Provider value={{ profile: profile.data, identity, client: identity.client, updateProfile: (next) => { if (isWorkspaceCurrent(identity)) identity.client.setQueryData(workspaceKeys.profile(user.id), next) } }}>{children}</WorkspaceContext.Provider>
}
