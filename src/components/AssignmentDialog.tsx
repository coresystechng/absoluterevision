import { FileUp, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
  assignmentProgressStages,
  assignmentStatuses,
  getAssignmentProgress,
} from "@/lib/assignment-status"
import {
  assignmentFileCategories,
  getAssignmentFileCategoryLabel,
} from "@/lib/assignment-files"
import {
  assignmentTypes,
  defaultAssignmentType,
  normalizeAssignmentType,
} from "@/lib/assignment-types"
import type {
  Assignment,
  AssignmentFileCategory,
  AssignmentFileUpload,
  AssignmentInput,
  AssignmentProgressStage,
  AssignmentPriority,
  AssignmentStatus,
  AssignmentType,
} from "@/types"

const priorityOptions: Array<{ value: AssignmentPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

function getInitialForm(assignment?: Assignment): Required<AssignmentInput> {
  const status = assignment?.status ?? "not-started"
  const progressStage = assignment?.progressStage ?? "ai-draft"

  return {
    title: assignment?.title ?? "",
    category: normalizeAssignmentType(assignment?.category),
    priority: assignment?.priority ?? "medium",
    status,
    progressStage,
    dueDate: assignment?.dueDate ?? "",
    dueTime: assignment?.dueTime ?? "",
    progress: getAssignmentProgress(status, progressStage),
    notes: assignment?.notes ?? "",
  }
}

type AssignmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment?: Assignment
  onSave: (
    input: AssignmentInput,
    files: AssignmentFileUpload[],
  ) => Promise<{ fileUploadFailed?: boolean } | void>
}

export function AssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onSave,
}: AssignmentDialogProps) {
  const [form, setForm] = useState(getInitialForm(assignment))
  const [fileCategory, setFileCategory] = useState<AssignmentFileCategory>("brief")
  const [selectedFiles, setSelectedFiles] = useState<AssignmentFileUpload[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(getInitialForm(assignment))
      setFileCategory("brief")
      setSelectedFiles([])
    }
  }, [assignment, open])

  const updateStatus = (status: AssignmentStatus) => {
    setForm((current) => ({
      ...current,
      status,
      progressStage:
        status === "completed"
          ? "final-review"
          : status === "not-started"
            ? "ai-draft"
            : current.progressStage,
      progress: getAssignmentProgress(
        status,
        status === "completed"
          ? "final-review"
          : status === "not-started"
            ? "ai-draft"
            : current.progressStage,
      ),
    }))
  }

  const updateProgressStage = (progressStage: AssignmentProgressStage) => {
    setForm((current) => ({
      ...current,
      status: "ongoing",
      progressStage,
      progress: getAssignmentProgress("ongoing", progressStage),
    }))
  }

  const addSelectedFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) {
      return
    }

    setSelectedFiles((current) => [
      ...current,
      ...files.map((file) => ({
        file,
        category: fileCategory,
      })),
    ])
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }

    setIsSaving(true)
    try {
      const result = await onSave(form, selectedFiles)
      onOpenChange(false)
      if (result?.fileUploadFailed) {
        toast.warning("Assignment saved, but some files could not be uploaded.")
      } else {
        toast.success(assignment ? "Assignment updated" : "Assignment created")
      }
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
              <Label htmlFor="assignment-type">Type</Label>
              <Select
                value={form.category ?? defaultAssignmentType}
                onValueChange={(value) => setForm((current) => ({ ...current, category: value as AssignmentType }))}
              >
                <SelectTrigger id="assignment-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid gap-4 sm:grid-cols-3">
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
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Progress</Label>
                <span className="text-sm font-medium">{form.progress}%</span>
              </div>
              <Select value={form.progressStage} onValueChange={(value) => updateProgressStage(value as AssignmentProgressStage)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select progress" />
                </SelectTrigger>
                <SelectContent>
                  {assignmentProgressStages.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>

          <div className="grid gap-3 rounded-md border p-3">
            <div className="grid gap-1">
              <Label>Assignment files</Label>
              <p className="text-sm text-muted-foreground">
                Attach briefs, notes, slides, guides, and drafts to this assignment.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="file-category">File category</Label>
                <Select
                  value={fileCategory}
                  onValueChange={(value) => setFileCategory(value as AssignmentFileCategory)}
                >
                  <SelectTrigger id="file-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentFileCategories.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" asChild>
                <Label htmlFor="assignment-files" className="cursor-pointer">
                  <FileUp className="h-4 w-4" />
                  Choose files
                </Label>
              </Button>
              <Input
                id="assignment-files"
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  addSelectedFiles(event.currentTarget.files)
                  event.currentTarget.value = ""
                }}
              />
            </div>

            {selectedFiles.length > 0 ? (
              <div className="grid gap-2">
                {selectedFiles.map((item, index) => (
                  <div
                    key={`${item.file.name}-${item.file.size}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <Badge variant="outline" className="mt-1">
                        {getAssignmentFileCategoryLabel(item.category)}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeSelectedFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
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
