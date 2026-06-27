import { format, parseISO } from "date-fns"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import * as assignmentApi from "@/api/assignments"
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
import {
  assignmentStatuses,
  getAssignmentStatusLabel,
} from "@/lib/assignment-status"
import { titleCase } from "@/lib/utils"
import type { Assignment, AssignmentInput, AssignmentStatus, AuthUser } from "@/types"

function formatDueDateTime(assignment: Assignment) {
  if (!assignment.dueDate) {
    return "Not set"
  }

  return format(
    parseISO(`${assignment.dueDate}T${assignment.dueTime ?? "00:00"}`),
    "MMM d, yyyy h:mm a",
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
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!Number.isFinite(id)) {
      return
    }

    setIsLoading(true)
    void getOrCreateUser(user)
      .then(() => assignmentApi.getById(user.id, id))
      .then((result) => {
        setAssignment(result)
      })
      .catch(() => toast.error("Something went wrong. Try again."))
      .finally(() => setIsLoading(false))
  }, [id, user])

  if (!Number.isFinite(id)) {
    return <Navigate to="/dashboard" replace />
  }

  const updateAssignment = async (input: AssignmentInput) => {
    const updated = await assignmentApi.update(user.id, id, input)
    if (updated) {
      setAssignment(updated)
    }
  }

  const updateStatus = async (status: AssignmentStatus) => {
    try {
      const updated = await assignmentApi.updateStatus(user.id, id, status)
      if (updated) {
        setAssignment(updated)
        toast.success(status === "completed" ? "Marked as complete" : "Assignment updated")
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
                  {assignment.category ? <Badge variant="outline">{assignment.category}</Badge> : null}
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
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="mt-1 font-medium">{assignment.category || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due date</p>
                    <p className="mt-1 font-medium">{formatDueDateTime(assignment)}</p>
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
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <p className="mt-1 font-medium">{titleCase(assignment.priority)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-2xl font-semibold">{assignment.progress}%</p>
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
