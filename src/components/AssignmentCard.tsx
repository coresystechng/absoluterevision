import { format, formatDistanceToNowStrict } from "date-fns"
import {
  CalendarClock,
  ClipboardList,
  GraduationCap,
  MoreHorizontal,
  Palette,
  Pencil,
  PenLine,
  Presentation,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { AssignmentDialog } from "@/components/AssignmentDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { getAssignmentStatusLabel } from "@/lib/assignment-status"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import {
  getAssignmentDeadline,
  isAssignmentDueSoon,
  isAssignmentOverdue,
} from "@/lib/dashboard-view"
import { cn } from "@/lib/utils"
import type {
  Assignment,
  AssignmentFileUpload,
  AssignmentInput,
  AssignmentType,
  TeamMember,
} from "@/types"

const assignmentTypeIcons: Record<AssignmentType, LucideIcon> = {
  Design: Palette,
  Copywriting: PenLine,
  Dissertation: GraduationCap,
  Assignment: ClipboardList,
  Presentation,
}

function statusBadgeTone(status: Assignment["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
  }
  if (status === "ongoing") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
  }
  return "border-border bg-muted/50 text-muted-foreground"
}

function priorityBadgeTone(priority: Assignment["priority"]) {
  if (priority === "high") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
  }
  if (priority === "medium") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300"
  }
  return "border-border bg-transparent text-muted-foreground"
}

function priorityLabel(priority: Assignment["priority"]) {
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`
}

function deadlineDetails(assignment: Assignment) {
  const deadline = getAssignmentDeadline(assignment)
  if (!deadline) {
    return { date: "No deadline", urgency: "Schedule not set", tone: "text-muted-foreground" }
  }

  const formatted = format(deadline, assignment.dueTime ? "EEE, d MMM · h:mm a" : "EEE, d MMM")
  if (assignment.status === "completed") {
    return { date: formatted, urgency: "Completed", tone: "text-muted-foreground" }
  }
  if (isAssignmentOverdue(assignment)) {
    return {
      date: formatted,
      urgency: `${formatDistanceToNowStrict(deadline)} overdue`,
      tone: "text-destructive",
    }
  }
  return {
    date: formatted,
    urgency: isAssignmentDueSoon(assignment)
      ? `Due in ${formatDistanceToNowStrict(deadline)}`
      : formatDistanceToNowStrict(deadline, { addSuffix: true }),
    tone: isAssignmentDueSoon(assignment)
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground",
  }
}

export function AssignmentCard({
  assignment,
  onUpdate,
  onDelete,
  canManage = assignment.currentUserRole === "admin",
  teamMembers = [],
}: {
  assignment: Assignment
  onUpdate: (
    input: AssignmentInput,
    files: AssignmentFileUpload[],
  ) => Promise<{ fileUploadFailed?: boolean } | void>
  onDelete: () => Promise<void>
  canManage?: boolean
  teamMembers?: TeamMember[]
}) {
  const [isEditing, setIsEditing] = useState(false)
  const assignmentType = normalizeAssignmentType(assignment.category)
  const AssignmentTypeIcon = assignmentTypeIcons[assignmentType]
  const deadline = deadlineDetails(assignment)
  const isCompleted = assignment.status === "completed"

  return (
    <>
      <Card
        className={cn(
          "h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md",
          isCompleted && "bg-muted/20",
        )}
      >
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/assignments/${assignment.id}`}
              className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Open ${assignment.title}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                  {assignment.title}
                </h3>
                <Badge variant="outline" className={cn("shrink-0", statusBadgeTone(assignment.status))}>
                  {getAssignmentStatusLabel(assignment.status)}
                </Badge>
              </div>
            </Link>
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`More actions for ${assignment.title}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setIsEditing(true) }}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(event) => {
                      event.preventDefault()
                      void onDelete()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <AssignmentTypeIcon className="h-4 w-4" aria-hidden="true" />
              {assignmentType}
            </span>
            <Badge variant="outline" className={cn("font-medium", priorityBadgeTone(assignment.priority))}>
              {priorityLabel(assignment.priority)}
            </Badge>
          </div>

          <div className={cn("flex items-start gap-2 text-sm", deadline.tone)}>
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block font-medium">{deadline.date}</span>
              <span className="block text-xs">{deadline.urgency}</span>
            </span>
          </div>

          {assignment.notes ? (
            <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {assignment.notes}
            </p>
          ) : null}

          <div className="mt-auto grid gap-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-semibold tabular-nums">{assignment.progress}%</span>
              </div>
              <Progress value={assignment.progress} aria-label={`${assignment.title} progress: ${assignment.progress}%`} />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {assignment.assigneeName || assignment.assigneeEmail || "Unassigned"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AssignmentDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        assignment={assignment}
        teamId={assignment.teamId}
        teamMembers={teamMembers}
        canAssign={canManage}
        onSave={onUpdate}
      />
    </>
  )
}
