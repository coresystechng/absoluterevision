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
import { normalizeAssignmentType } from "@/lib/assignment-types"
import { cn } from "@/lib/utils"
import type { Assignment, AssignmentInput, AssignmentType } from "@/types"

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
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
  }
  return "border-border bg-transparent text-muted-foreground"
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
}: {
  assignment: Assignment
  onUpdate: (input: AssignmentInput) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const assignmentType = normalizeAssignmentType(assignment.category)
  const AssignmentTypeIcon = assignmentTypeIcons[assignmentType]

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
          </div>

          {assignment.notes ? (
            <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {assignment.notes}
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-end">
            <Badge
              variant="outline"
              className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", priorityBadgeTone(assignment.priority))}
            >
              {assignment.priority.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <AssignmentDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        assignment={assignment}
        onSave={onUpdate}
      />
    </>
  )
}
