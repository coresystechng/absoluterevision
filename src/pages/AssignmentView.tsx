import { format, parseISO } from "date-fns"
import { ArrowLeft, CalendarClock, CheckCircle2, Copy, Pencil, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import * as assignmentApi from "@/api/assignments"
import { AssignmentFiles } from "@/components/AssignmentFiles"
import { getOrCreateUser } from "@/api/users"
import { AssignmentDialog } from "@/components/AssignmentDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Navbar } from "@/components/Navbar"
import { StatePanel } from "@/components/StatePanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useTeams } from "@/hooks/useTeams"
import { uploadAssignmentFileSelection } from "@/lib/assignment-file-uploads"
import {
  assignmentProgressStages,
  assignmentStatuses,
  getAssignmentProgressLabel,
} from "@/lib/assignment-status"
import { getDeadlinePresentation, getPriorityPresentation, getStatusPresentation, semanticTextClassNames } from "@/lib/assignment-presentation"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import { splitTrackingCode } from "@/lib/public-assignment-status"
import type {
  Assignment,
  AssignmentActivity,
  AssignmentActivityAction,
  AssignmentFileUpload,
  AssignmentInput,
  AssignmentProgressStage,
  AssignmentStatus,
  AuthUser,
} from "@/types"

type ActivityTimelineItem = {
  id: number | string
  action: AssignmentActivityAction
  message: string
  createdAt: string
}

type AssignmentLoadState = "loading" | "success" | "not-found" | "error"

function getActorName(user: AuthUser) {
  return user.displayName?.trim() || user.email.split("@")[0] || "User"
}

function getActivityItems(
  assignment: Assignment,
  activities: AssignmentActivity[],
  actorName: string,
): ActivityTimelineItem[] {
  const hasCreatedActivity = activities.some((activity) => activity.action === "created")
  const syntheticCreatedActivity: ActivityTimelineItem = {
    id: "created",
    action: "created",
    message: `${actorName} created the assignment`,
    createdAt: assignment.createdAt,
  }

  return [
    ...(hasCreatedActivity ? [] : [syntheticCreatedActivity]),
    ...activities,
  ].sort(
    (a, b) =>
      parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime(),
  )
}

export function AssignmentView({
  user,
  onSignOut,
}: {
  user: AuthUser
  onSignOut: () => void | Promise<void>
}) {
  const params = useParams()
  const navigate = useNavigate()
  const id = Number(params.id)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [activities, setActivities] = useState<AssignmentActivity[]>([])
  const [loadState, setLoadState] = useState<AssignmentLoadState>("loading")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activityError, setActivityError] = useState(false)
  const requestId = useRef(0)
  const assignmentRef = useRef(assignment)
  assignmentRef.current = assignment
  const [isEditing, setIsEditing] = useState(false)
  const [filesVersion, setFilesVersion] = useState(0)
  const actorName = getActorName(user)
  const { members } = useTeams(user.id, assignment?.teamId ?? null)

  const refreshActivities = useCallback(async () => {
    if (!Number.isFinite(id)) {
      return
    }

    setActivityError(false)
    try {
      setActivities(await assignmentApi.getActivities(user.id, id))
    } catch {
      setActivityError(true)
    }
  }, [id, user.id])

  const loadAssignment = useCallback(async () => {
    if (!Number.isFinite(id)) return
    const currentRequest = ++requestId.current
    const isSameAssignment = assignmentRef.current?.id === id
    if (isSameAssignment) {
      setIsRefreshing(true)
    } else {
      assignmentRef.current = null
      setAssignment(null)
      setActivities([])
      setLoadState("loading")
    }
    try {
      await getOrCreateUser(user)
      const result = await assignmentApi.getById(user.id, id)
      if (currentRequest !== requestId.current) return
      if (!result) {
        setAssignment(null)
        setLoadState("not-found")
        return
      }
      setAssignment(result)
      setLoadState("success")
      setActivityError(false)
      try {
        const activityResult = await assignmentApi.getActivities(user.id, id)
        if (currentRequest === requestId.current) setActivities(activityResult)
      } catch {
        if (currentRequest === requestId.current) setActivityError(true)
      }
    } catch {
      if (currentRequest === requestId.current && !assignmentRef.current) setLoadState("error")
    } finally {
      if (currentRequest === requestId.current) setIsRefreshing(false)
    }
  }, [id, user])

  useEffect(() => {
    void loadAssignment()
    return () => { requestId.current += 1 }
  }, [loadAssignment])

  if (!Number.isFinite(id)) {
    return <Navigate to="/dashboard" replace />
  }

  const uploadFiles = async (files: AssignmentFileUpload[]) => {
    if (files.length === 0) {
      return false
    }

    const result = await uploadAssignmentFileSelection({
      userId: user.id,
      actorName,
      assignmentId: id,
      files,
    })
    if (result.uploaded > 0) {
      setFilesVersion((current) => current + 1)
    }
    return result.failed > 0
  }

  const updateAssignment = async (input: AssignmentInput, files: AssignmentFileUpload[]) => {
    const updated = await assignmentApi.update(user.id, id, input, actorName)
    if (updated) {
      setAssignment(updated)
      const fileUploadFailed = await uploadFiles(files)
      await refreshActivities()
      return { fileUploadFailed }
    }
  }

  const updateStatus = async (status: AssignmentStatus) => {
    try {
      const updated = await assignmentApi.updateStatus(user.id, id, status, actorName)
      if (updated) {
        setAssignment(updated)
        await refreshActivities()
        toast.success(status === "completed" ? "Marked as complete" : "Assignment updated")
      }
    } catch {
      toast.error("Something went wrong. Try again.")
    }
  }

  const updateProgressStage = async (progressStage: AssignmentProgressStage) => {
    try {
      const updated = await assignmentApi.updateProgressStage(user.id, id, progressStage, actorName)
      if (updated) {
        setAssignment(updated)
        await refreshActivities()
        toast.success("Progress updated")
      }
    } catch {
      toast.error("Something went wrong. Try again.")
    }
  }

  const deleteAssignment = async () => {
    try {
      await assignmentApi.remove(user.id, id)
      toast.error("Assignment deleted")
      navigate("/dashboard")
    } catch {
      toast.error("Something went wrong. Try again.")
    }
  }

  const copyTrackingCredentials = async () => {
    if (!assignment) return
    const credentials = splitTrackingCode(assignment.trackingCode)
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(`Reference: ${credentials.reference}\nAccess code: ${credentials.accessCode}`)
      toast.success("Tracking details copied")
    } catch {
      toast.error("Could not copy the tracking details")
    }
  }

  const copyTrackingLink = async () => {
    if (!assignment) return
    try {
      const url = `${window.location.origin}/track-assignment`
      await navigator.clipboard.writeText(url)
      toast.success("Tracking link copied")
    } catch {
      toast.error("Could not copy the tracking link")
    }
  }

  const assignmentType = assignment ? normalizeAssignmentType(assignment.category) : null
  const trackingCredentials = assignment ? splitTrackingCode(assignment.trackingCode) : null
  const activityItems = assignment
    ? getActivityItems(assignment, activities, actorName)
    : []
  const canManageAssignment = assignment?.currentUserRole === "admin"
  const statusPresentation = assignment ? getStatusPresentation(assignment.status) : null
  const priorityPresentation = assignment ? getPriorityPresentation(assignment.priority) : null
  const deadlinePresentation = assignment ? getDeadlinePresentation(assignment) : null
  const canAccessDropboxFileActions = Boolean(
    assignment &&
      (assignment.currentUserRole === "admin" || assignment.assigneeUserId === user.id),
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        user={user}
        onSignOut={onSignOut}
        activeTeamName={loadState === "loading" ? undefined : assignment?.teamName ?? null}
      />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
        <Button variant="ghost" asChild className="w-fit px-0">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <div aria-busy={loadState === "loading" || isRefreshing || undefined}>
        {loadState === "loading" ? (
          <div className="grid gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-80" />
          </div>
        ) : loadState === "success" && assignment ? (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge variant={priorityPresentation!.tone}>{priorityPresentation!.label}</Badge>
                  <Badge variant={statusPresentation!.tone}>{statusPresentation!.label}</Badge>
                  <Badge variant="outline">{getAssignmentProgressLabel(assignment.progressStage)}</Badge>
                  <Badge variant="outline">{assignmentType}</Badge>
                </div>
                <h1 className="text-3xl font-semibold tracking-normal">{assignment.title}</h1>
              </div>
              {canManageAssignment ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <ConfirmDialog
                    title="Delete assignment?"
                    description="This removes the assignment permanently."
                    onConfirm={deleteAssignment}
                  >
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </ConfirmDialog>
                </div>
              ) : null}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Assignment details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Team</p>
                    <p className="mt-1 font-medium">{assignment.teamName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned to</p>
                    <p className="mt-1 font-medium">
                      {assignment.assigneeName || assignment.assigneeEmail || "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="mt-1 font-medium">{assignmentType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <div className={`mt-1 flex items-center gap-2 text-sm ${semanticTextClassNames[deadlinePresentation!.tone]}`}>
                      {assignment.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <CalendarClock className="h-4 w-4" />
                      )}
                      <span>{deadlinePresentation!.label}</span>
                    </div>
                  </div>
                  <div className="grid content-start gap-1">
                    <Label className="font-normal text-muted-foreground">Status</Label>
                    {canManageAssignment ? (
                      <Select
                        value={assignment.status}
                        onValueChange={(value) => void updateStatus(value as AssignmentStatus)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignmentStatuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={statusPresentation!.tone} className="w-fit">
                        {statusPresentation!.label}
                      </Badge>
                    )}
                  </div>
                  <div className="grid content-start gap-1">
                    {canManageAssignment ? (
                      <>
                        <Label className="font-normal text-muted-foreground">
                          Progress ({assignment.progress}%)
                        </Label>
                        <Select
                          value={assignment.progressStage}
                          onValueChange={(value) => void updateProgressStage(value as AssignmentProgressStage)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignmentProgressStages.map((progressStage) => (
                              <SelectItem key={progressStage.value} value={progressStage.value}>
                                {progressStage.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <Label className="font-normal text-muted-foreground">
                          Progress ({assignment.progress}%)
                        </Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {getAssignmentProgressLabel(assignment.progressStage)}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <Badge variant={priorityPresentation!.tone} className="mt-1 w-fit">{priorityPresentation!.label}</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7">{assignment.notes || "No notes added."}</p>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Created at {format(parseISO(assignment.createdAt), "MMM d, yyyy h:mm a")}</p>
                  <p>Last updated {format(parseISO(assignment.updatedAt), "MMM d, yyyy h:mm a")}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Client tracking</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm text-muted-foreground">Share both private details only with the intended client. The tracking page URL contains no credentials.</p>
                {trackingCredentials ? <div className="grid gap-3 rounded-md border bg-muted/50 p-4 sm:grid-cols-2">
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p><p className="mt-1 font-mono text-sm font-medium">{trackingCredentials.reference}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Access code</p><p className="mt-1 break-all font-mono text-sm font-medium">{trackingCredentials.accessCode}</p></div>
                </div> : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void copyTrackingCredentials()}><Copy className="h-4 w-4" />Copy tracking details</Button>
                  <Button variant="outline" onClick={() => void copyTrackingLink()}><Copy className="h-4 w-4" />Copy clean tracking link</Button>
                </div>
              </CardContent>
            </Card>

            <AssignmentFiles
              key={`${assignment.id}-${filesVersion}`}
              assignmentId={assignment.id}
              user={user}
              actorName={actorName}
              onActivityChange={refreshActivities}
              canUpload={canAccessDropboxFileActions}
              allowedCategories={canManageAssignment ? undefined : ["final"]}
              canDownload={canAccessDropboxFileActions}
              canDelete={canManageAssignment}
            />

            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activityError ? (
                  <StatePanel context="inline" tone="error" title="Could not load activity" description="The assignment is still available." primaryAction={{ label: "Try again", onClick: () => void refreshActivities() }} live="polite" />
                ) : <div className="grid gap-1">
                  {activityItems.map((activity) => (
                    <div
                      key={`${activity.id}-${activity.createdAt}`}
                      className="relative border-l pb-5 pl-5 last:pb-0"
                    >
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border bg-background" />
                      <p className="text-sm leading-6">{activity.message}</p>
                      <time
                        className="mt-1 block text-xs text-muted-foreground"
                        dateTime={activity.createdAt}
                      >
                        {format(parseISO(activity.createdAt), "MMM d, yyyy h:mm a")}
                      </time>
                    </div>
                  ))}
                </div>}
              </CardContent>
            </Card>

            <AssignmentDialog
              open={isEditing}
              onOpenChange={setIsEditing}
              assignment={assignment}
              teamId={assignment.teamId}
              teamMembers={members}
              canAssign={canManageAssignment}
              onSave={updateAssignment}
            />
          </>
        ) : loadState === "error" ? (
          <StatePanel context="page" tone="error" title="Could not load this assignment" description="The assignment could not be loaded right now." primaryAction={{ label: "Try again", onClick: () => void loadAssignment() }} secondaryAction={{ label: "Back to dashboard", onClick: () => navigate("/dashboard") }} live="assertive" />
        ) : (
          <StatePanel context="page" title="Assignment not found" description="This assignment does not exist or you do not have access to it." primaryAction={{ label: "Back to dashboard", onClick: () => navigate("/dashboard") }} />
        )}
        </div>
      </main>
    </div>
  )
}
