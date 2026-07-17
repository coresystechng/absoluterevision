import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { BookOpenCheck, Plus, Search, SlidersHorizontal, UsersRound } from "lucide-react"

import { getOrCreateUser, updateActiveTeamSelection, updateDashboardFilters } from "@/api/users"
import { AssignmentCard } from "@/components/AssignmentCard"
import { AssignmentDialog } from "@/components/AssignmentDialog"
import { DashboardFilters } from "@/components/DashboardFilters"
import { DashboardSummary, type DashboardQuickView } from "@/components/DashboardSummary"
import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTeams } from "@/hooks/useTeams"
import { uploadAssignmentFileSelection } from "@/lib/assignment-file-uploads"
import { getAssignmentStatusLabel } from "@/lib/assignment-status"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import { defaultDashboardFilters } from "@/lib/dashboard-preferences"
import {
  deriveDashboardView,
  getDashboardSummary,
  isAssignmentDueSoon,
  isAssignmentOverdue,
  type DashboardSortDirection,
  type DashboardSortField,
} from "@/lib/dashboard-view"
import type {
  Assignment,
  AssignmentFileUpload,
  AssignmentInput,
  AuthUser,
  DashboardFilterPreferences,
} from "@/types"

function matchesFilters(filters: DashboardFilterPreferences, assignment: Assignment) {
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
    assignment.teamName,
    assignment.assigneeName,
    assignment.assigneeEmail,
    assignment.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
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
  const [filters, setFilters] = useState<DashboardFilterPreferences>(defaultDashboardFilters)
  const [sortField, setSortField] = useState<DashboardSortField>("deadline")
  const [sortDirection, setSortDirection] = useState<DashboardSortDirection>("asc")
  const [searchQuery, setSearchQuery] = useState("")
  const [quickView, setQuickView] = useState<DashboardQuickView>("all")
  const [showCompleted, setShowCompleted] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<DashboardFilterPreferences>(defaultDashboardFilters)
  const [draftSortField, setDraftSortField] = useState<DashboardSortField>("deadline")
  const [draftSortDirection, setDraftSortDirection] = useState<DashboardSortDirection>("asc")
  const [isSavingFilters, setIsSavingFilters] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null)
  const [isSwitchingTeam, setIsSwitchingTeam] = useState(false)
  const actorName = getActorName(user)
  const isMobile = useMediaQuery("(max-width: 639px)")
  const {
    teams,
    members,
    isLoading: teamsLoading,
    error: teamsError,
    reloadTeams,
  } = useTeams(user.id, activeTeamId)
  const activeTeam = useMemo(
    () => teams.find((team) => team.id === activeTeamId) ?? null,
    [activeTeamId, teams],
  )
  const canManageActiveTeam = activeTeam?.role === "admin"
  const { assignments, isLoading, error, reload, create, update, remove } = useAssignments(
    user.id,
    actorName,
    activeTeam?.id ?? null,
  )

  useEffect(() => {
    void getOrCreateUser(user)
      .then((profile) => {
        setFilters(profile.dashboardFilters)
        setActiveTeamId(profile.activeTeamId)
        return reloadTeams()
      })
      .catch(() => toast.error("Something went wrong. Try again."))
  }, [reloadTeams, user])

  useEffect(() => {
    if (teamsLoading) {
      return
    }

    if (teams.length === 0) {
      setActiveTeamId(null)
      return
    }

    if (!activeTeamId || !teams.some((team) => team.id === activeTeamId)) {
      setActiveTeamId(teams[0].id)
    }
  }, [activeTeamId, teams, teamsLoading])

  const summary = useMemo(() => getDashboardSummary(assignments), [assignments])
  const filteredAssignments = useMemo(() => {
    const matchesQuickView = (assignment: Assignment) => {
      if (quickView === "attention") {
        return isAssignmentOverdue(assignment) || isAssignmentDueSoon(assignment)
      }
      if (quickView === "ongoing") return assignment.status === "ongoing"
      if (quickView === "completed") return assignment.status === "completed"
      return true
    }

    return assignments.filter(
      (assignment) =>
        matchesFilters(filters, assignment) &&
        matchesSearch(assignment, searchQuery) &&
        matchesQuickView(assignment),
    )
  }, [assignments, filters, quickView, searchQuery])
  const assignmentView = useMemo(
    () => deriveDashboardView(filteredAssignments, sortField, sortDirection),
    [filteredAssignments, sortDirection, sortField],
  )
  const completedAreVisible =
    showCompleted || quickView === "completed" || filters.status === "completed"
  const activeFilterCount = Object.values(filters).filter((value) => value !== "all").length

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
    if (!activeTeam) {
      throw new Error("Create a team before adding assignments.")
    }

    const assignment = await create({
      ...input,
      teamId: activeTeam.id,
      assigneeUserId: input.assigneeUserId ?? user.id,
    })
    return { fileUploadFailed: await uploadFiles(assignment.id, files) }
  }

  const switchTeam = async (nextTeamId: number) => {
    const previousTeamId = activeTeamId
    setActiveTeamId(nextTeamId)
    setIsSwitchingTeam(true)
    try {
      await updateActiveTeamSelection(user.id, nextTeamId)
      toast.success("Workspace switched")
    } catch {
      setActiveTeamId(previousTeamId)
      toast.error("Could not switch workspace. Your previous workspace is still selected.")
    } finally {
      setIsSwitchingTeam(false)
    }
  }

  const applyFilters = async (nextFilters: DashboardFilterPreferences) => {
    const previousFilters = filters
    setFilters(nextFilters)
    setIsSavingFilters(true)
    try {
      await updateDashboardFilters(user.id, nextFilters)
    } catch {
      setFilters(previousFilters)
      toast.error("Could not save filters. Your previous filters were restored.")
    } finally {
      setIsSavingFilters(false)
    }
  }

  const openFilters = () => {
    setDraftFilters(filters)
    setDraftSortField(sortField)
    setDraftSortDirection(sortDirection)
    setFiltersOpen(true)
  }

  const clearFilters = () => {
    setQuickView("all")
    void applyFilters(defaultDashboardFilters)
  }

  const resetDashboardView = () => {
    setSearchQuery("")
    setQuickView("all")
    setShowCompleted(false)
    void applyFilters(defaultDashboardFilters)
  }

  const activeFilterLabels = [
    filters.type !== "all" ? { key: "type", label: filters.type } : null,
    filters.priority !== "all" ? { key: "priority", label: `${filters.priority} priority` } : null,
    filters.status !== "all" ? { key: "status", label: getAssignmentStatusLabel(filters.status) } : null,
  ].filter(Boolean) as Array<{ key: keyof DashboardFilterPreferences; label: string }>

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        user={user}
        onSignOut={onSignOut}
        activeTeamName={teamsLoading ? undefined : activeTeam?.name ?? null}
      />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter and sort team assignments by the work that matters now.
            </p>
          </div>
          {canManageActiveTeam ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New assignment
            </Button>
          ) : activeTeam ? (
            <p className="max-w-xs text-sm text-muted-foreground sm:text-right">
              Team members can review assignments. Ask a team admin to create or edit work.
            </p>
          ) : null}
        </div>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Active workspace">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UsersRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active workspace</p>
              <p className="truncate font-semibold">{activeTeam?.name ?? (teamsLoading ? "Loading workspace…" : "No workspace selected")}</p>
              {activeTeam ? (
                <p className="text-sm text-muted-foreground">
                  {activeTeam.memberCount} {activeTeam.memberCount === 1 ? "member" : "members"} · {activeTeam.role === "admin" ? "Admin" : "Member"}
                </p>
              ) : null}
            </div>
          </div>
          {teams.length > 1 ? (
            <Select
              value={activeTeam ? String(activeTeam.id) : ""}
              onValueChange={(value) => void switchTeam(Number(value))}
              disabled={teamsLoading || isSwitchingTeam}
            >
              <SelectTrigger className="w-full sm:w-60" aria-label="Switch active workspace">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </section>

        <DashboardSummary counts={summary} activeView={quickView} onViewChange={setQuickView} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search assignments"
              className="h-11 pl-9"
              aria-label="Search assignments by title, type, priority, status, assignee, or notes"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-center rounded-xl px-4 sm:w-auto"
            aria-expanded={filtersOpen && !isMobile}
            aria-controls="dashboard-filters"
            onClick={() => filtersOpen ? setFiltersOpen(false) : openFilters()}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 ? (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground"
                aria-label={`${activeFilterCount} active ${activeFilterCount === 1 ? "filter" : "filters"}`}
              >
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        {activeFilterLabels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {activeFilterLabels.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void applyFilters({ ...filters, [key]: "all" })}
                aria-label={`Remove ${label} filter`}
              >
                {label} <span aria-hidden="true">×</span>
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
          </div>
        ) : null}

        {filtersOpen && !isMobile ? (
          <div id="dashboard-filters">
            <DashboardFilters
              filters={filters}
              sortField={sortField}
              sortDirection={sortDirection}
              onFiltersChange={(next) => void applyFilters(next)}
              onSortFieldChange={setSortField}
              onSortDirectionChange={setSortDirection}
              onClear={clearFilters}
              disabled={isSavingFilters}
            />
          </div>
        ) : null}

        {isMobile ? (
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogContent className="left-0 top-auto bottom-0 max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-5">
              <DialogHeader>
                <DialogTitle>Filter and sort</DialogTitle>
                <DialogDescription>Narrow the assignments shown in this workspace.</DialogDescription>
              </DialogHeader>
              <DashboardFilters
                mobile
                filters={draftFilters}
                sortField={draftSortField}
                sortDirection={draftSortDirection}
                onFiltersChange={setDraftFilters}
                onSortFieldChange={setDraftSortField}
                onSortDirectionChange={setDraftSortDirection}
                onClear={() => {
                  setDraftFilters(defaultDashboardFilters)
                  setDraftSortField("deadline")
                  setDraftSortDirection("asc")
                }}
                onApply={() => {
                  setSortField(draftSortField)
                  setSortDirection(draftSortDirection)
                  void applyFilters(draftFilters)
                  setFiltersOpen(false)
                }}
                disabled={isSavingFilters}
              />
            </DialogContent>
          </Dialog>
        ) : null}

        {teamsError ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div>
                <h2 className="font-semibold text-destructive">Could not load workspaces</h2>
                <p className="mt-1 text-sm text-muted-foreground">Check your connection and try loading your team list again.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void reloadTeams()}>Retry workspaces</Button>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <div>
                <h2 className="font-semibold text-destructive">Could not load assignments</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your workspace is still selected. Try loading its assignments again.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void reload()}>Retry assignments</Button>
            </CardContent>
          </Card>
        ) : teamsLoading || isLoading ? (
          <div role="status" aria-label="Loading assignments" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <span className="sr-only">Loading assignments…</span>
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : !activeTeam ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted">
                <UsersRound className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mt-6 text-lg font-semibold">No workspace selected</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Choose or create a workspace before reviewing team assignments.</p>
              <Button asChild className="mt-6"><Link to="/settings">Manage workspaces</Link></Button>
            </CardContent>
          </Card>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted">
                <BookOpenCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mt-6 text-lg font-semibold">This workspace has no assignments yet</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {canManageActiveTeam
                  ? "Create the first assignment to start tracking the team's work."
                  : "A team admin can add the first assignment. You will see it here when it is ready."}
              </p>
              {canManageActiveTeam ? (
                <Button className="mt-6" onClick={() => setDialogOpen(true)}>Create first assignment</Button>
              ) : null}
            </CardContent>
          </Card>
        ) : filteredAssignments.length > 0 ? (
          <div className="grid gap-8">
            {assignmentView.incomplete.length > 0 ? (
              <section aria-labelledby="active-work-heading">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 id="active-work-heading" className="text-xl font-semibold">Active work</h2>
                  <span className="text-sm text-muted-foreground">{assignmentView.incomplete.length} assignments</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignmentView.incomplete.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onUpdate={async (input, files) => {
                  await update(assignment.id, {
                    ...input,
                    teamId: assignment.teamId,
                    assigneeUserId: input.assigneeUserId ?? assignment.assigneeUserId,
                  })
                  return { fileUploadFailed: await uploadFiles(assignment.id, files) }
                }}
                onDelete={async () => {
                  await remove(assignment.id)
                  toast.error("Assignment deleted")
                }}
                canManage={assignment.currentUserRole === "admin"}
                teamMembers={members}
              />
            ))}
                </div>
              </section>
            ) : null}
            {assignmentView.completed.length > 0 ? (
              <section aria-labelledby="completed-work-heading">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 id="completed-work-heading" className="text-xl font-semibold">Completed work</h2>
                    <p className="text-sm text-muted-foreground">{assignmentView.completed.length} assignments</p>
                  </div>
                  {quickView !== "completed" && filters.status !== "completed" ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCompleted((value) => !value)} aria-expanded={completedAreVisible}>
                      {completedAreVisible ? "Hide completed" : "Show completed"}
                    </Button>
                  ) : null}
                </div>
                {completedAreVisible ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {assignmentView.completed.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onUpdate={async (input, files) => {
                          await update(assignment.id, {
                            ...input,
                            teamId: assignment.teamId,
                            assigneeUserId: input.assigneeUserId ?? assignment.assigneeUserId,
                          })
                          return { fileUploadFailed: await uploadFiles(assignment.id, files) }
                        }}
                        onDelete={async () => {
                          await remove(assignment.id)
                          toast.error("Assignment deleted")
                        }}
                        canManage={assignment.currentUserRole === "admin"}
                        teamMembers={members}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted">
                <BookOpenCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mt-6 text-lg font-semibold">No assignments match this view</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Clear your search, quick view, and filters to see all assignments in this workspace.
              </p>
              <Button className="mt-6" variant="outline" onClick={resetDashboardView}>Clear view</Button>
            </CardContent>
          </Card>
        )}
      </main>

      <AssignmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={activeTeam?.id}
        teamMembers={members}
        canAssign={canManageActiveTeam}
        onSave={createAssignment}
      />
    </div>
  )
}
