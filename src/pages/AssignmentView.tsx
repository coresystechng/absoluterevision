import { format, parseISO } from "date-fns"
import { ArrowLeft, CalendarClock, CheckCircle2, Pencil, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import * as assignmentApi from "@/api/assignments"
import { AssignmentFiles } from "@/components/AssignmentFiles"
import { getOrCreateUser } from "@/api/users"
import { AssignmentDialog } from "@/components/AssignmentDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Navbar } from "@/components/Navbar"
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
import { uploadAssignmentFileSelection } from "@/lib/assignment-file-uploads"
import {
  assignmentProgressStages,
  assignmentStatuses,
  getAssignmentProgressLabel,
  getAssignmentStatusLabel,
} from "@/lib/assignment-status"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import { getProgressBadgeStyle, titleCase } from "@/lib/utils"
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

function dueDateTime(assignment: Assignment) {
  if (!assignment.dueDate) {
    return null
  }

  return parseISO(`${assignment.dueDate}T${assignment.dueTime ?? "00:00"}`)
}

function dueTone(assignment: Assignment) {
  const due = dueDateTime(assignment)
  if (!due || assignment.status === "completed") {
    return assignment.status === "completed" ? "text-foreground" : "text-muted-foreground"
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const soon = new Date(today)
  soon.setDate(today.getDate() + 3)

  if (due < today) {
    return "text-destructive"
  }
  if (due > today && due < soon) {
    return "text-amber-600 dark:text-amber-400"
  }
  return "text-muted-foreground"
}

function getTimeLeftLabel(assignment: Assignment) {
  if (assignment.status === "completed") {
    return "Submitted"
  }

  const due = dueDateTime(assignment)
  if (!due) {
    return "No deadline"
  }

  const diffMs = due.getTime() - Date.now()
  if (diffMs <= 0) {
    return "Overdue"
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days}d ${hours} hrs left`
  }

  if (hours > 0) {
    return `${hours} hrs ${minutes} mins left`
  }

  if (minutes > 0) {
    return `${minutes} mins left`
  }

  return "Due soon"
}

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
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [filesVersion, setFilesVersion] = useState(0)
  const actorName = getActorName(user)

  const refreshActivities = useCallback(async () => {
    if (!Number.isFinite(id)) {
      return
    }

    setActivities(await assignmentApi.getActivities(user.id, id))
  }, [id, user.id])

  useEffect(() => {
    if (!Number.isFinite(id)) {
      return
    }

    setIsLoading(true)
    setActivities([])
    void getOrCreateUser(user)
      .then(() =>
        Promise.all([
          assignmentApi.getById(user.id, id),
          assignmentApi.getActivities(user.id, id),
        ]),
      )
      .then(([result, activityResult]) => {
        setAssignment(result)
        setActivities(activityResult)
      })
      .catch(() => toast.error("Something went wrong. Try again."))
      .finally(() => setIsLoading(false))
  }, [id, user])

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

  const assignmentType = assignment ? normalizeAssignmentType(assignment.category) : null
  const activityItems = assignment
    ? getActivityItems(assignment, activities, actorName)
    : []

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onSignOut={onSignOut} />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
        <Button variant="ghost" asChild className="w-fit px-0">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        {isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-80" />
          </div>
        ) : assignment ? (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge>{titleCase(assignment.priority)}</Badge>
                  <Badge variant="secondary">{getAssignmentStatusLabel(assignment.status)}</Badge>
                  <Badge variant="outline">{getAssignmentProgressLabel(assignment.progressStage)}</Badge>
                  <Badge variant="outline">{assignmentType}</Badge>
                </div>
                <h1 className="text-3xl font-semibold tracking-normal">{assignment.title}</h1>
              </div>
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
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Assignment details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="mt-1 font-medium">{assignmentType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <div className={`mt-1 flex items-center gap-2 text-sm ${dueTone(assignment)}`}>
                      {assignment.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <CalendarClock className="h-4 w-4" />
                      )}
                      <span>{getTimeLeftLabel(assignment)}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={assignment.status} onValueChange={(value) => void updateStatus(value as AssignmentStatus)}>
                      <SelectTrigger className="mt-2">
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
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label>Progress</Label>
                      <Badge
                        className="rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm"
                        style={getProgressBadgeStyle(assignment.progress)}
                      >
                        {assignment.progress}%
                      </Badge>
                    </div>
                    <Select value={assignment.progressStage} onValueChange={(value) => void updateProgressStage(value as AssignmentProgressStage)}>
                      <SelectTrigger className="mt-2">
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
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <p className="mt-1 font-medium">{titleCase(assignment.priority)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">Progress summary</p>
                  <Badge
                    className="w-fit rounded-full border px-3 py-1 text-sm font-semibold shadow-sm"
                    style={getProgressBadgeStyle(assignment.progress)}
                  >
                    {getAssignmentProgressLabel(assignment.progressStage)} - {assignment.progress}%
                  </Badge>
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

            <AssignmentFiles
              key={`${assignment.id}-${filesVersion}`}
              assignmentId={assignment.id}
              user={user}
              actorName={actorName}
              onActivityChange={refreshActivities}
            />

            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1">
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
                </div>
              </CardContent>
            </Card>

            <AssignmentDialog
              open={isEditing}
              onOpenChange={setIsEditing}
              assignment={assignment}
              onSave={updateAssignment}
            />
          </>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Assignment not found.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
