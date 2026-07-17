import { isAfter, isBefore, parseISO } from "date-fns"
import {
  CalendarClock,
  CheckCircle2,
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
import { useNavigate } from "react-router-dom"

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
import { normalizeAssignmentType } from "@/lib/assignment-types"
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

function statusTone(status: Assignment["status"]) {
  if (status === "completed") {
    return "text-emerald-600 dark:text-emerald-400"
  }
  if (status === "ongoing") {
    return "text-amber-600 dark:text-amber-400"
  }
  return "text-muted-foreground"
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
  if (priority === "high") {
    return "High"
  }
  if (priority === "medium") {
    return "Medium"
  }
  return "Low"
}

function priorityInitial(priority: Assignment["priority"]) {
  return priority.charAt(0).toUpperCase()
}

function dueDateTime(assignment: Assignment) {
  if (!assignment.dueDate) {
    return null
  }

  return parseISO(`${assignment.dueDate}T${assignment.dueTime ?? "00:00"}`)
}

function dueTone(assignment: Assignment) {
  const due = dueDateTime(assignment)
  if (assignment.status === "completed") {
    return "text-foreground"
  }
  if (!due) {
    return "text-muted-foreground"
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const soon = new Date(today)
  soon.setDate(today.getDate() + 3)

  if (isBefore(due, today)) {
    return "text-destructive"
  }
  if (isAfter(due, today) && isBefore(due, soon)) {
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
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const assignmentType = normalizeAssignmentType(assignment.category)
  const AssignmentTypeIcon = assignmentTypeIcons[assignmentType]
  const progress = Math.min(Math.max(assignment.progress, 0), 100)

  return (
    <>
      <Card
        className="h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/assignments/${assignment.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            navigate(`/assignments/${assignment.id}`)
          }
        }}
      >
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <AssignmentTypeIcon
                  className={cn("h-5 w-5 shrink-0", statusTone(assignment.status))}
                  aria-label={`${assignmentType} assignment type`}
                />
                <h3 className={cn("truncate text-base font-semibold", statusTone(assignment.status))}>
                  {assignment.title}
                </h3>
              </div>
              <div className={cn("mt-2 flex items-center gap-2 text-sm", dueTone(assignment))}>
                {assignment.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                <span>{getTimeLeftLabel(assignment)}</span>
              </div>
            </div>
            {canManage ? (
              <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
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
              </div>
            ) : null}
          </div>

          {assignment.notes ? (
            <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {assignment.notes}
            </p>
          ) : null}

          <div className="mt-auto grid gap-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-semibold text-foreground">{progress}%</span>
              </div>
              <Progress
                value={progress}
                className="h-1.5"
                aria-label={`${assignment.title} progress`}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {assignment.assigneeName || assignment.assigneeEmail || "Unassigned"}
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "h-7 w-7 justify-center rounded-full px-0 text-xs font-semibold",
                  priorityBadgeTone(assignment.priority),
                )}
                aria-label={`${priorityLabel(assignment.priority)} priority`}
                title={priorityLabel(assignment.priority)}
              >
                {priorityInitial(assignment.priority)}
              </Badge>
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
