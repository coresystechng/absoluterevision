import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BookOpenCheck, Plus, Search } from "lucide-react"

import { getOrCreateUser } from "@/api/users"
import { AssignmentCard } from "@/components/AssignmentCard"
import { AssignmentDialog } from "@/components/AssignmentDialog"
import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssignments, type AssignmentFilter } from "@/hooks/useAssignments"
import { getAssignmentStatusLabel } from "@/lib/assignment-status"
import type { Assignment, AssignmentInput, AuthUser } from "@/types"

const filters: Array<{ value: AssignmentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "not-started", label: "Not Started" },
  { value: "completed", label: "Completed" },
  { value: "high-priority", label: "High priority" },
]

function isOverdue(assignment: Assignment) {
  if (!assignment.dueDate || assignment.status === "completed") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${assignment.dueDate}T${assignment.dueTime ?? "00:00"}`) < today
}

function matchesFilter(filter: AssignmentFilter, assignment: Assignment) {
  if (filter === "all") return true
  if (filter === "high-priority") return assignment.priority === "high" && assignment.status !== "completed"
  if (filter === "overdue") return isOverdue(assignment)
  return assignment.status === filter
}

function matchesSearch(assignment: Assignment, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [
    assignment.title,
    assignment.category,
    assignment.priority,
    getAssignmentStatusLabel(assignment.status),
    assignment.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

export function Dashboard({
  user,
  onSignOut,
}: {
  user: AuthUser
  onSignOut: () => void | Promise<void>
}) {
  const [filter, setFilter] = useState<AssignmentFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const { assignments, isLoading, error, reload, create, update, remove } = useAssignments(user.id)

  useEffect(() => {
    void getOrCreateUser(user)
      .then(() => reload())
      .catch(() => toast.error("Something went wrong. Try again."))
  }, [reload, user])

  const filteredAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) => matchesFilter(filter, assignment) && matchesSearch(assignment, searchQuery),
      ),
    [assignments, filter, searchQuery],
  )

  const createAssignment = async (input: AssignmentInput) => {
    await create(input)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onSignOut={onSignOut} />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Assignments sorted by priority and due date.</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New assignment
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search assignments, status, priority, category, or notes"
            className="h-11 pl-9"
            aria-label="Search assignments"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {error ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">Something went wrong. Try again.</CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : filteredAssignments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onUpdate={(input) => update(assignment.id, input).then(() => undefined)}
                onDelete={async () => {
                  await remove(assignment.id)
                  toast.error("Assignment deleted")
                }}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted">
                <BookOpenCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mt-6 text-lg font-semibold">No assignments match this view</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Create your first assignment or switch filters to review existing work.
              </p>
              <Button className="mt-6" onClick={() => setDialogOpen(true)}>
                Create your first assignment
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <AssignmentDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={createAssignment} />
    </div>
  )
}
