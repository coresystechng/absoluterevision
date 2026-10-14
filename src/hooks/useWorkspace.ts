import { createContext, useContext } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { UserProfile } from "@/types"
import type { WorkspaceGeneration } from "@/lib/workspace-cache"

export type WorkspaceContextValue = {
  profile: UserProfile
  client: QueryClient
  identity: WorkspaceGeneration
  updateProfile: (profile: UserProfile) => void
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("WorkspaceProvider is required")
  return value
}
