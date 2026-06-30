import { isAfter, isBefore, parseISO } from "date-fns"
import { CalendarClock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
import {
  getAssignmentProgressLabel,
  getAssignmentStatusLabel,
} from "@/lib/assignment-status"
import { cn, getProgressBadgeStyle, titleCase } from "@/lib/utils"
import type { Assignment, AssignmentInput } from "@/types"

function priorityDot(priority: Assignment["priority"]) {
  if (priority === "high") {
    return "bg-red-500"
  }
  if (priority === "medium") {
    return "bg-yellow-400"
  }
  return "bg-white ring-1 ring-border"
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
        <CardContent className="grid gap-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", priorityDot(assignment.priority))}
                  aria-label={`${titleCase(assignment.priority)} priority`}
                />
                <h3 className="truncate text-base font-semibold">{assignment.title}</h3>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{getAssignmentStatusLabel(assignment.status)}</Badge>
                <Badge variant="outline">{getAssignmentProgressLabel(assignment.progressStage)}</Badge>
                {assignment.category ? <Badge variant="outline">{assignment.category}</Badge> : null}
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

          <div className={cn("flex items-center gap-2 text-sm", dueTone(assignment))}>
            <CalendarClock className="h-4 w-4" />
            <span>{getTimeLeftLabel(assignment)}</span>
          </div>

          <div className="flex items-center justify-end">
            <Badge className="rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm" style={getProgressBadgeStyle(assignment.progress)}>
              {assignment.progress}%
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
