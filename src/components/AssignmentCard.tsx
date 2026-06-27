import { format, isAfter, isBefore, parseISO } from "date-fns"
import { CalendarClock, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { AssignmentDialog } from "@/components/AssignmentDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getAssignmentStatusLabel,
} from "@/lib/assignment-status"
import { cn, titleCase } from "@/lib/utils"
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
                {assignment.category ? <Badge variant="outline">{assignment.category}</Badge> : null}
              </div>
            </div>
            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" aria-label="Edit assignment" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <ConfirmDialog
                title="Delete assignment?"
                description="This removes the assignment permanently."
                onConfirm={onDelete}
              >
                <Button type="button" variant="ghost" size="icon" aria-label="Delete assignment">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ConfirmDialog>
            </div>
          </div>

          <div className={cn("flex items-center gap-2 text-sm", dueTone(assignment))}>
            <CalendarClock className="h-4 w-4" />
            <span>
              {assignment.dueDate
                ? format(dueDateTime(assignment) ?? parseISO(assignment.dueDate), "MMM d, yyyy h:mm a")
                : "No due date"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{assignment.progress}%</span>
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
