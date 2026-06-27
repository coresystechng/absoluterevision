import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  assignmentStatuses,
  getAssignmentProgress,
} from "@/lib/assignment-status"
import type {
  Assignment,
  AssignmentInput,
  AssignmentPriority,
  AssignmentStatus,
} from "@/types"

const priorityOptions: Array<{ value: AssignmentPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

function getInitialForm(assignment?: Assignment): Required<AssignmentInput> {
  const status = assignment?.status ?? "not-started"

  return {
    title: assignment?.title ?? "",
    category: assignment?.category ?? "",
    priority: assignment?.priority ?? "medium",
    status,
    dueDate: assignment?.dueDate ?? "",
    dueTime: assignment?.dueTime ?? "",
    progress: getAssignmentProgress(status),
    notes: assignment?.notes ?? "",
  }
}

type AssignmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment?: Assignment
  onSave: (input: AssignmentInput) => Promise<void>
}

export function AssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSave,
}: AssignmentDialogProps) {
  const [form, setForm] = useState(getInitialForm(assignment))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(getInitialForm(assignment))
    }
  }, [assignment, open])

  const updateStatus = (status: AssignmentStatus) => {
    setForm((current) => ({
      ...current,
      status,
      progress: getAssignmentProgress(status),
    }))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }

    setIsSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
      toast.success(assignment ? "Assignment updated" : "Assignment created")
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{assignment ? "Edit assignment" : "New assignment"}</DialogTitle>
          <DialogDescription>
            Capture the work, deadline, priority, and current progress.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="Writing, Maths, Science"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueTime">Due time</Label>
              <Input
                id="dueTime"
                type="time"
                value={form.dueTime ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((current) => ({ ...current, priority: value as AssignmentPriority }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => updateStatus(value as AssignmentStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentStatuses.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
              <span className="text-sm font-medium">{getAssignmentProgress(form.status)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Progress is calculated from the current assignment status.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save assignment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
