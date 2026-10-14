import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as assignmentApi from "@/api/assignments"
import { confirmAssignmentRemoval, reconcileAssignment, workspaceKeys } from "@/lib/workspace-cache"
import type { Assignment, AssignmentInput, AssignmentProgressStage, AssignmentStatus } from "@/types"

export type AssignmentFilter = "all" | "not-started" | "ongoing" | "completed" | "high-priority" | "overdue"
function isOverdue(assignment: Assignment) {
  if (!assignment.dueDate || assignment.status === "completed") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${assignment.dueDate}T00:00:00`) < today
}
export function useAssignments(userId: string | null, actorName?: string | null, teamId?: number | null) {
  const client = useQueryClient()
  const enabled = Boolean(userId && Number.isInteger(teamId) && Number(teamId) > 0)
  const query = useQuery({ queryKey: workspaceKeys.assignments(userId ?? "", teamId ?? 0), enabled, queryFn: () => assignmentApi.getAll(userId!, teamId!) })
  const requireUser = () => { if (!userId) throw new Error("Missing user"); return userId }
  const reconcile = (result: Assignment | null) => reconcileAssignment(client, requireUser(), result)
  return {
    assignments: query.data ?? [],
    isLoading: enabled && query.isPending,
    isRefreshing: query.isFetching && query.data !== undefined,
    error: query.error,
    reload: async () => { if (enabled) await query.refetch() },
    isOverdue,
    create: async (input: AssignmentInput) => reconcile(await assignmentApi.create(requireUser(), input, actorName)),
    update: async (id: number, input: AssignmentInput) => reconcile(await assignmentApi.update(requireUser(), id, input, actorName)),
    updateStatus: async (id: number, status: AssignmentStatus) => reconcile(await assignmentApi.updateStatus(requireUser(), id, status, actorName)),
    updateProgressStage: async (id: number, progressStage: AssignmentProgressStage) => reconcile(await assignmentApi.updateProgressStage(requireUser(), id, progressStage, actorName)),
    remove: async (id: number) => confirmAssignmentRemoval(client, requireUser(), id),
  }
}
