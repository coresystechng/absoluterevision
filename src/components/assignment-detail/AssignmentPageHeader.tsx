import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getStatusPresentation } from "@/lib/assignment-presentation"
import type { Assignment } from "@/types"

type AssignmentPageHeaderProps = {
  assignment: Assignment
  canManage: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
}

export function AssignmentPageHeader({ assignment, canManage, onEdit, onDelete }: AssignmentPageHeaderProps) {
  const status = getStatusPresentation(assignment.status)

  return (
    <div className="grid gap-5">
      <Link to="/dashboard" className="flex w-fit items-center gap-2 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2">
            <Badge variant={status.tone}>{status.label}</Badge>
          </div>
          <h1 className="break-words text-3xl font-semibold tracking-normal">{assignment.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {assignment.teamName} · {assignment.assigneeName || assignment.assigneeEmail || "Unassigned"}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <ConfirmDialog title="Delete assignment?" description="This removes the assignment permanently." onConfirm={onDelete}>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </ConfirmDialog>
          </div>
        ) : null}
      </div>
    </div>
  )
}
