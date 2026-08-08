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
import { getDeadlinePresentation, getPriorityPresentation, getProgressPresentation, semanticTextClassNames } from "@/lib/assignment-presentation"
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

function priorityInitial(priority: Assignment["priority"]) {
  return priority.charAt(0).toUpperCase()
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
  const progressPresentation = getProgressPresentation(assignment.status, assignment.progressStage)
  const priorityPresentation = getPriorityPresentation(assignment.priority)
  const deadlinePresentation = getDeadlinePresentation(assignment)

  return (
    <>
      <Card
        className="h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md active:border-primary/60"
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
                  className={cn("h-5 w-5 shrink-0", semanticTextClassNames[progressPresentation.tone])}
                  aria-label={`${assignmentType} assignment type`}
                />
                <h3 className="truncate text-base font-semibold">
                  {assignment.title}
                </h3>
              </div>
              <div className={cn("mt-2 flex items-center gap-2 text-sm", semanticTextClassNames[deadlinePresentation.tone])}>
                {assignment.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                <span>{deadlinePresentation.label}</span>
              </div>
            </div>
            {canManage ? (
              <div
                className="flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
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
                tone={progressPresentation.tone}
                aria-label={`${assignment.title} progress`}
                aria-valuetext={`${progressPresentation.label}, ${progress}%`}
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
                variant={priorityPresentation.tone}
                className={cn(
                  "h-7 w-7 justify-center rounded-full px-0 text-xs font-semibold",
                )}
                aria-label={`${priorityPresentation.label} priority`}
                title={priorityPresentation.label}
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
