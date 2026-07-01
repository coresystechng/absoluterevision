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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssignments } from "@/hooks/useAssignments"
import { uploadAssignmentFileSelection } from "@/lib/assignment-file-uploads"
import { assignmentStatuses, getAssignmentStatusLabel } from "@/lib/assignment-status"
import { assignmentTypes, normalizeAssignmentType } from "@/lib/assignment-types"
import type {
  Assignment,
  AssignmentFileUpload,
  AssignmentInput,
  AssignmentPriority,
  AssignmentStatus,
  AssignmentType,
  AuthUser,
} from "@/types"

type FilterValue<T extends string> = T | "all"
type SortField = "deadline" | "name"
type SortDirection = "asc" | "desc"

type DashboardFilters = {
  type: FilterValue<AssignmentType>
  priority: FilterValue<AssignmentPriority>
  status: FilterValue<AssignmentStatus>
}

const priorityOptions: Array<{ value: AssignmentPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

const sortFieldOptions: Array<{ value: SortField; label: string }> = [
  { value: "deadline", label: "Deadline" },
  { value: "name", label: "Assignment Name" },
]

const sortDirectionOptions: Array<{ value: SortDirection; label: string }> = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
]

const defaultFilters: DashboardFilters = {
  type: "all",
  priority: "all",
  status: "ongoing",
}

function getDeadlineTime(assignment: Assignment) {
  if (!assignment.dueDate) {
    return null
  }

  return new Date(`${assignment.dueDate}T${assignment.dueTime ?? "00:00"}`).getTime()
}

function matchesFilters(filters: DashboardFilters, assignment: Assignment) {
  const assignmentType = normalizeAssignmentType(assignment.category)

  return (
    (filters.type === "all" || assignmentType === filters.type) &&
    (filters.priority === "all" || assignment.priority === filters.priority) &&
    (filters.status === "all" || assignment.status === filters.status)
  )
}

function matchesSearch(assignment: Assignment, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [
    assignment.title,
    normalizeAssignmentType(assignment.category),
    assignment.priority,
    getAssignmentStatusLabel(assignment.status),
    assignment.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function compareAssignments(
  a: Assignment,
  b: Assignment,
  sortField: SortField,
  sortDirection: SortDirection,
) {
  const direction = sortDirection === "asc" ? 1 : -1

  if (sortField === "name") {
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) * direction
  }

  const deadlineA = getDeadlineTime(a)
  const deadlineB = getDeadlineTime(b)

  if (deadlineA === null && deadlineB === null) {
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  }
  if (deadlineA === null) {
    return 1
  }
  if (deadlineB === null) {
    return -1
  }

  const deadlineComparison = deadlineA - deadlineB
  if (deadlineComparison !== 0) {
    return deadlineComparison * direction
  }

  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
}

function getActorName(user: AuthUser) {
  return user.displayName?.trim() || user.email.split("@")[0] || "User"
}

export function Dashboard({
  user,
  onSignOut,
}: {
  user: AuthUser
  onSignOut: () => void | Promise<void>
}) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters)
  const [sortField, setSortField] = useState<SortField>("deadline")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const actorName = getActorName(user)
  const { assignments, isLoading, error, reload, create, update, remove } = useAssignments(user.id, actorName)

  useEffect(() => {
    void getOrCreateUser(user)
      .then(() => reload())
      .catch(() => toast.error("Something went wrong. Try again."))
  }, [reload, user])

  const filteredAssignments = useMemo(
    () =>
      [...assignments]
        .filter((assignment) => matchesFilters(filters, assignment) && matchesSearch(assignment, searchQuery))
        .sort((a, b) => compareAssignments(a, b, sortField, sortDirection)),
    [assignments, filters, searchQuery, sortDirection, sortField],
  )

  const uploadFiles = async (
    assignmentId: number,
    files: AssignmentFileUpload[],
  ) => {
    if (files.length === 0) {
      return false
    }

    const result = await uploadAssignmentFileSelection({
      userId: user.id,
      actorName,
      assignmentId,
      files,
    })
    return result.failed > 0
  }

  const createAssignment = async (input: AssignmentInput, files: AssignmentFileUpload[]) => {
    const assignment = await create(input)
    return { fileUploadFailed: await uploadFiles(assignment.id, files) }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onSignOut={onSignOut} />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Filter and sort assignments by the work that matters now.</p>
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
            placeholder="Search assignments, type, priority, status, or notes"
            className="h-11 pl-9"
            aria-label="Search assignments"
          />
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Assignment Type</span>
            <Select
              value={filters.type}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, type: value as DashboardFilters["type"] }))
              }
            >
              <SelectTrigger aria-label="Filter by assignment type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {assignmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Priority</span>
            <Select
              value={filters.priority}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, priority: value as DashboardFilters["priority"] }))
              }
            >
              <SelectTrigger aria-label="Filter by priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorityOptions.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Status</span>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, status: value as DashboardFilters["status"] }))
              }
            >
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {assignmentStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Sort By</span>
            <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
              <SelectTrigger aria-label="Sort assignments by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortFieldOptions.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Order</span>
            <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
              <SelectTrigger aria-label="Sort direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortDirectionOptions.map((direction) => (
                  <SelectItem key={direction.value} value={direction.value}>
                    {direction.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                onUpdate={async (input, files) => {
                  await update(assignment.id, input)
                  return { fileUploadFailed: await uploadFiles(assignment.id, files) }
                }}
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
