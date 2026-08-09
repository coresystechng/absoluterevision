import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { assignmentProgressStages, assignmentStatuses, getAssignmentProgressLabel } from "@/lib/assignment-status"
import { getDeadlinePresentation, getPriorityPresentation, getProgressPresentation, semanticTextClassNames } from "@/lib/assignment-presentation"
import { normalizeAssignmentType } from "@/lib/assignment-types"
import type { Assignment, AssignmentProgressStage, AssignmentStatus } from "@/types"

type AssignmentWorkflowPanelProps = {
  assignment: Assignment
  canManage: boolean
  saving: boolean
  error: boolean
  onStatus: (value: AssignmentStatus) => void
  onProgress: (value: AssignmentProgressStage) => void
}

export function AssignmentWorkflowPanel({ assignment, canManage, saving, error, onStatus, onProgress }: AssignmentWorkflowPanelProps) {
  const priority = getPriorityPresentation(assignment.priority)
  const deadline = getDeadlinePresentation(assignment)
  const progress = getProgressPresentation(assignment.status, assignment.progressStage)

  return (
    <Card>
      <CardHeader><CardTitle>Details</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Type</dt><dd className="mt-1 font-medium">{normalizeAssignmentType(assignment.category)}</dd></div>
          <div><dt className="text-muted-foreground">Priority</dt><dd className="mt-1"><Badge variant={priority.tone}>{priority.label}</Badge></dd></div>
          <div><dt className="text-muted-foreground">Team</dt><dd className="mt-1 font-medium">{assignment.teamName}</dd></div>
          <div><dt className="text-muted-foreground">Assignee</dt><dd className="mt-1 font-medium">{assignment.assigneeName || assignment.assigneeEmail || "Unassigned"}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Deadline</dt><dd className={`mt-1 font-medium ${semanticTextClassNames[deadline.tone]}`}>{deadline.label}</dd></div>
        </dl>
        {canManage ? (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <Label htmlFor="assignment-view-status">Status</Label>
              <Select value={assignment.status} onValueChange={(value) => onStatus(value as AssignmentStatus)} disabled={saving}>
                <SelectTrigger id="assignment-view-status"><SelectValue /></SelectTrigger>
                <SelectContent>{assignmentStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="assignment-view-progress">Progress</Label>
              <Select value={assignment.progressStage} onValueChange={(value) => onProgress(value as AssignmentProgressStage)} disabled={saving}>
                <SelectTrigger id="assignment-view-progress"><SelectValue /></SelectTrigger>
                <SelectContent>{assignmentProgressStages.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <p className="text-sm"><span className="text-muted-foreground">Current stage:</span> <span className="font-medium">{getAssignmentProgressLabel(assignment.progressStage)}</span></p>
        )}
        <div className="grid gap-2">
          <div className="flex justify-between text-sm"><span>{progress.label}</span><span>{assignment.progress}%</span></div>
          <Progress value={assignment.progress} tone={progress.tone} aria-label="Assignment progress" />
        </div>
        {saving ? <p role="status" className="text-sm text-muted-foreground">Saving assignment progress…</p> : null}
        {error ? <p role="alert" className="text-sm text-danger-foreground">The progress change could not be saved. Your last confirmed values are shown.</p> : null}
      </CardContent>
    </Card>
  )
}
