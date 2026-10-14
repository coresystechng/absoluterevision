import { useQuery } from "@tanstack/react-query"
import * as assignmentApi from "@/api/assignments"
import { workspaceKeys } from "@/lib/workspace-cache"

export function useAssignment(userId: string, id: number) {
  return useQuery({ queryKey: workspaceKeys.assignment(userId, id), enabled: Number.isInteger(id) && id > 0, queryFn: () => assignmentApi.getById(userId, id) })
}
