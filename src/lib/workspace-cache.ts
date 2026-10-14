import { QueryClient } from "@tanstack/react-query"
import type { Assignment, AuthUser, UserProfile } from "@/types"
import { getOrCreateUser } from "@/api/users"
import * as assignmentApi from "@/api/assignments"

export const workspaceKeys = {
  root: (id: string) => ["workspace", id] as const,
  profile: (id: string) => ["workspace", id, "profile"] as const,
  teams: (id: string) => ["workspace", id, "teams"] as const,
  members: (id: string, team: number) => ["workspace", id, "members", team] as const,
  assignments: (id: string, team: number) => ["workspace", id, "assignments", team] as const,
  assignment: (id: string, assignment: number) => ["workspace", id, "assignment", assignment] as const,
}
export const workspaceReadOptions = { staleTime: 30_000, gcTime: 300_000, retry: false as const }
export function createWorkspaceClient() {
  return new QueryClient({ defaultOptions: { queries: workspaceReadOptions } })
}
export type WorkspaceGeneration = { userId: string; generation: number; client: QueryClient }
let active: WorkspaceGeneration | null = null
let generation = 0
const listeners = new Set<() => void>()
let signOutPending = false
let signOutOwner: string | null = null
let signOutToken = 0
export function getWorkspaceSignOutPending() { return signOutPending }
export function getWorkspaceSignOutOwner() { return signOutOwner }
export function isWorkspaceSignOutCurrent(token: number) { return signOutPending && token === signOutToken }
export function setWorkspaceSignOutPending(pending: boolean, userId: string | null = null) {
  signOutPending = pending
  signOutOwner = pending ? userId : null
  const token = ++signOutToken
  listeners.forEach((listener) => listener())
  return token
}
export function subscribeWorkspace(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function getWorkspaceGeneration() { return active }
export function isWorkspaceCurrent(value: WorkspaceGeneration) { return active === value }
export function isWorkspaceClientCurrent(client: QueryClient, userId: string) { return active?.client === client && active.userId === userId }
export function disposeWorkspace(value = active) {
  if (!value || value !== active) return
  active = null
  void value.client.cancelQueries()
  value.client.clear()
  listeners.forEach((listener) => listener())
}
export function acquireWorkspace(userId: string) {
  if (active?.userId === userId) return active
  disposeWorkspace()
  active = { userId, generation: ++generation, client: createWorkspaceClient() }
  listeners.forEach((listener) => listener())
  return active
}

// SQL provisioning cannot be physically cancelled. Keep unfinished writes single-flight
// even when their original query client has been disposed.
const pendingProfiles = new Map<string, Promise<UserProfile>>()
export function provisionWorkspace(user: AuthUser) {
  const existing = pendingProfiles.get(user.id)
  if (existing) return existing
  const pending = getOrCreateUser(user).finally(() => {
    if (pendingProfiles.get(user.id) === pending) pendingProfiles.delete(user.id)
  })
  pendingProfiles.set(user.id, pending)
  return pending
}

export async function reconcileAssignment(client: QueryClient, userId: string, result: Assignment | null) {
  if (!result) throw new Error("The assignment update was not accepted. Try again.")
  if (active?.client !== client || active.userId !== userId) return result
  const lists = { queryKey: [...workspaceKeys.root(userId), "assignments"], predicate: (query: { queryKey: readonly unknown[]; state: { data: unknown } }) => query.queryKey[3] === result.teamId || (Array.isArray(query.state.data) && (query.state.data as Assignment[]).some((item) => item.id === result.id)) }
  await Promise.all([client.cancelQueries(lists), client.cancelQueries({ queryKey: workspaceKeys.assignment(userId, result.id) })])
  if (active?.client !== client) return result
  for (const query of client.getQueryCache().findAll(lists)) {
    const values = query.state.data as Assignment[] | undefined
    if (!values) continue
    const without = values.filter((value) => value.id !== result.id)
    client.setQueryData(query.queryKey, query.queryKey[3] === result.teamId ? [...without, result] : without)
  }
  client.setQueryData(workspaceKeys.assignment(userId, result.id), result)
  await Promise.all([client.invalidateQueries({ ...lists, refetchType: "none" }), client.invalidateQueries({ queryKey: workspaceKeys.assignment(userId, result.id), refetchType: "none" })])
  return result
}

export async function confirmAssignmentRemoval(client: QueryClient, userId: string, id: number) {
  await assignmentApi.remove(userId, id)
  if (active?.client !== client) return
  const lists = { queryKey: [...workspaceKeys.root(userId), "assignments"] }
  const detail = { queryKey: workspaceKeys.assignment(userId, id) }
  await Promise.all([client.cancelQueries(lists), client.cancelQueries(detail)])
  await Promise.all([client.invalidateQueries({ ...lists, refetchType: "none" }), client.invalidateQueries({ ...detail, refetchType: "none" })])
  const remaining = await assignmentApi.getById(userId, id)
  if (active?.client !== client) return
  if (remaining) {
    await reconcileAssignment(client, userId, remaining)
    throw new Error("Removal could not be confirmed. Try again.")
  }
  await Promise.all([client.cancelQueries(lists), client.cancelQueries(detail)])
  if (active?.client !== client) return
  client.setQueriesData<Assignment[]>(lists, (values) => values?.filter((value) => value.id !== id))
  client.setQueryData(workspaceKeys.assignment(userId, id), null)
}

export async function purgeTeamAssignments(client: QueryClient, userId: string, teamIds: number[]) {
  if (active?.client !== client) return
  const matches = (query: { queryKey: readonly unknown[]; state: { data: unknown } }) => query.queryKey[0] === "workspace" && query.queryKey[1] === userId && (
    (query.queryKey[2] === "assignments" && teamIds.includes(Number(query.queryKey[3]))) ||
    (query.queryKey[2] === "assignment" && (!query.state.data || teamIds.includes((query.state.data as Assignment).teamId)))
  )
  await client.cancelQueries({ predicate: matches })
  if (active?.client === client) client.removeQueries({ predicate: matches })
}
