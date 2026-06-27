import { useCallback, useEffect, useMemo, useState } from "react"

import * as assignmentApi from "@/api/assignments"
import type { Assignment, AssignmentInput, AssignmentStatus } from "@/types"

export type AssignmentFilter =
  | "all"
  | "not-started"
  | "ai-draft"
  | "humaned"
  | "grammar-check"
  | "ai-plagiarism-check"
  | "text-format"
  | "review"
  | "completed"
  | "high-priority"
  | "overdue"

function isOverdue(assignment: Assignment) {
  if (!assignment.dueDate || assignment.status === "completed") {
    return false
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${assignment.dueDate}T00:00:00`) < today
}

export function useAssignments(userId: string | null) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    if (!userId) {
      setAssignments([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      setAssignments(await assignmentApi.getAll(userId))
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const actions = useMemo(
    () => ({
      create: async (input: AssignmentInput) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        const assignment = await assignmentApi.create(userId, input)
        await reload()
        return assignment
      },
      update: async (id: number, input: AssignmentInput) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        const assignment = await assignmentApi.update(userId, id, input)
        await reload()
        return assignment
      },
      updateStatus: async (id: number, status: AssignmentStatus) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        const assignment = await assignmentApi.updateStatus(userId, id, status)
        await reload()
        return assignment
      },
      remove: async (id: number) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        await assignmentApi.remove(userId, id)
        await reload()
      },
    }),
    [reload, userId],
  )

  return { assignments, isLoading, error, reload, isOverdue, ...actions }
}
