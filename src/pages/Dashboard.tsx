import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BookOpenCheck, Plus } from "lucide-react"

import { getOrCreateUser, updateActiveTeamSelection } from "@/api/users"
import { AssignmentCard } from "@/components/AssignmentCard"
import { AssignmentDialog } from "@/components/AssignmentDialog"
import { Navbar } from "@/components/Navbar"
import { StatePanel } from "@/components/StatePanel"
import { DashboardSummary } from "@/components/DashboardSummary"
import { DashboardFilters } from "@/components/DashboardFilters"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssignments } from "@/hooks/useAssignments"
import { useTeams } from "@/hooks/useTeams"
import { uploadAssignmentFileSelection } from "@/lib/assignment-file-uploads"
import { getAssignmentStatusLabel } from "@/lib/assignment-status"
import { defaultDashboardFilters } from "@/lib/dashboard-preferences"
import { dashboardCounts, deriveDashboardView, type DashboardQuickView } from "@/lib/dashboard-view"
import type {
  AssignmentFileUpload,
  AssignmentInput,
  AuthUser,
  DashboardFilterPreferences,
} from "@/types"

type SortField = "deadline" | "name"
type SortDirection = "asc" | "desc"
type DashboardFilterKey = keyof DashboardFilterPreferences

type ActiveFilter = {
  key: DashboardFilterKey
  label: string
}

function getActorName(user: AuthUser) {
  return user.displayName?.trim() || user.email.split("@")[0] || "User"
}

function getActiveFilters(filters: DashboardFilterPreferences): ActiveFilter[] {
  const activeFilters: ActiveFilter[] = []

  if (filters.type !== "all") {
    activeFilters.push({ key: "type", label: filters.type })
  }

  if (filters.priority !== "all") {
    const priorityLabel = `${filters.priority[0].toUpperCase()}${filters.priority.slice(1)}`
    activeFilters.push({
      key: "priority",
      label: `${priorityLabel ?? filters.priority} priority`,
    })
  }

  if (filters.status !== "all") {
    activeFilters.push({
      key: "status",
      label: getAssignmentStatusLabel(filters.status),
    })
  }

  return activeFilters
}

export function Dashboard({
  user,
  onSignOut,
}: {
  user: AuthUser
  onSignOut: () => void | Promise<void>
}) {
  const [filters, setFilters] = useState<DashboardFilterPreferences>(defaultDashboardFilters)
  const [sortField, setSortField] = useState<SortField>("deadline")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null)
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  const [quickView, setQuickView] = useState<DashboardQuickView>("all")
  const [completedOpen, setCompletedOpen] = useState(false)
  const actorName = getActorName(user)
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
  const { assignments, isLoading, isRefreshing, error, reload, create, update, remove } = useAssignments(
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

  const dashboardView = useMemo(() => deriveDashboardView(assignments, { filters, query: searchQuery, quickView, sortField, sortDirection }), [assignments, filters, quickView, searchQuery, sortDirection, sortField])
  const counts = useMemo(() => dashboardCounts(assignments), [assignments])
  const filteredAssignments = dashboardView.all
  const activeFilters = getActiveFilters(filters)
  const activeFilterCount = activeFilters.length

  const changeTeam = async (teamId: number) => {
    const previous = activeTeamId; setIsSavingTeam(true)
    try { const profile = await updateActiveTeamSelection(user.id, teamId); setActiveTeamId(profile.activeTeamId); toast.success("Workspace changed") }
    catch { setActiveTeamId(previous); toast.error("Could not change workspace.") }
    finally { setIsSavingTeam(false) }
  }

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
            {activeTeam ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><strong>{activeTeam.name}</strong><span className="text-muted-foreground">{activeTeam.role === "admin" ? "Administrator" : "Member"} · {activeTeam.memberCount} {activeTeam.memberCount === 1 ? "member" : "members"}</span>{teams.length > 1 ? <Select value={String(activeTeam.id)} onValueChange={(value) => void changeTeam(Number(value))} disabled={isSavingTeam}><SelectTrigger className="w-52" aria-label="Switch active workspace"><SelectValue /></SelectTrigger><SelectContent>{teams.map((team)=><SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>)}</SelectContent></Select> : null}</div> : null}
          </div>
          <Button onClick={() => setDialogOpen(true)} disabled={!canManageActiveTeam} aria-describedby={!canManageActiveTeam ? "new-assignment-unavailable" : undefined}>
            <Plus className="h-4 w-4" />
            New assignment
          </Button>
          {!canManageActiveTeam ? <p id="new-assignment-unavailable" className="text-sm text-muted-foreground sm:max-w-xs">{activeTeam ? "Only team administrators can create assignments." : "Select or create a team before adding assignments."}</p> : null}
        </div>

        <DashboardSummary counts={counts} value={quickView} onChange={(value) => { setQuickView(value); if (value === "completed") setCompletedOpen(true) }} />

        <DashboardFilters filters={filters} onFilters={setFilters} query={searchQuery} onQuery={setSearchQuery} sortField={sortField} onSortField={setSortField} sortDirection={sortDirection} onSortDirection={setSortDirection} />

        {teamsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : teamsError && teams.length === 0 ? (
          <StatePanel tone="error" title="Could not load your teams" description="Your workspace is temporarily unavailable." primaryAction={{ label: "Try again", onClick: () => void reloadTeams() }} live="assertive" />
        ) : !activeTeam ? (
          <StatePanel title="Create a team to get started" description="Assignments belong to a team workspace." />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
          </div>
        ) : error && assignments.length === 0 ? (
          <StatePanel tone="error" title="Could not load assignments" description="Your assignments are temporarily unavailable." primaryAction={{ label: "Try again", onClick: () => void reload() }} live="assertive" />
        ) : filteredAssignments.length > 0 ? (
          <div className="grid gap-4" aria-busy={isRefreshing || undefined}>
          {error ? <StatePanel context="inline" tone="warning" title="Could not refresh assignments" description="Showing the last available results." primaryAction={{ label: "Try again", onClick: () => void reload() }} live="polite" /> : null}
          <div className="grid gap-6">
          <section className="grid gap-3" aria-labelledby="active-work-heading"><h2 id="active-work-heading" className="text-lg font-semibold">Active work ({dashboardView.incomplete.length})</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardView.incomplete.map((assignment) => (
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
                  toast.success("Assignment deleted")
                }}
                canManage={assignment.currentUserRole === "admin"}
                teamMembers={members}
              />
            ))}
          </div></section>
          {dashboardView.completed.length > 0 ? <section className="grid gap-3" aria-labelledby="completed-work-heading"><div className="flex items-center justify-between"><h2 id="completed-work-heading" className="text-lg font-semibold">Completed ({dashboardView.completed.length})</h2><Button variant="ghost" size="sm" aria-expanded={completedOpen || filters.status === "completed" || quickView === "completed"} onClick={()=>setCompletedOpen(v=>!v)}>{completedOpen ? "Hide completed" : "Show completed"}</Button></div>{completedOpen || filters.status === "completed" || quickView === "completed" ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{dashboardView.completed.map((assignment)=><AssignmentCard key={assignment.id} assignment={assignment} onUpdate={async(input,files)=>{ await update(assignment.id,{...input,teamId:assignment.teamId,assigneeUserId:input.assigneeUserId??assignment.assigneeUserId}); return {fileUploadFailed:await uploadFiles(assignment.id,files)} }} onDelete={async()=>{await remove(assignment.id);toast.success("Assignment deleted")}} canManage={assignment.currentUserRole === "admin"} teamMembers={members} />)}</div> : null}</section> : null}
          </div>
          </div>
        ) : searchQuery.trim() || activeFilterCount > 0 ? (
          <StatePanel icon={BookOpenCheck} title="No assignments match this view" description="Clear the search or filters to see other assignments." />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted">
                <BookOpenCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="mt-6 text-lg font-semibold">No assignments yet</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Create your first assignment or switch filters to review existing work.
              </p>
              {canManageActiveTeam ? (
                <Button className="mt-6" onClick={() => setDialogOpen(true)}>
                  Create your first assignment
                </Button>
              ) : null}
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
