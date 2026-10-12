import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { assignmentTypes } from "@/lib/assignment-types"
import type { ClientSubmission, SubmissionAssignmentInput, SubmissionTeam } from "../../shared/client-submissions"

const selectClassName = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"

export function SubmissionConversionDialog({ submission, teams, userId, onClose, onConvert }: {
  submission: ClientSubmission
  teams: SubmissionTeam[]
  userId: string
  onClose: () => void
  onConvert: (input: SubmissionAssignmentInput) => Promise<void>
}) {
  const firstTeam = teams[0]
  const [teamId, setTeamId] = useState(firstTeam?.id ?? 0)
  const [assigneeUserId, setAssigneeUserId] = useState(firstTeam?.members.find((member) => member.userId === userId)?.userId ?? firstTeam?.members[0]?.userId ?? "")
  const [title, setTitle] = useState(submission.files.find((file) => file.status === "ready")?.name.replace(/\.[^.]+$/, "") ?? `Submission from ${submission.fullName}`)
  const [category, setCategory] = useState<SubmissionAssignmentInput["category"]>("Assignment")
  const [priority, setPriority] = useState<SubmissionAssignmentInput["priority"]>("medium")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedTeam = teams.find((team) => team.id === teamId)
  const readyFiles = submission.files.filter((file) => file.status === "ready")

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onConvert({ submissionId: submission.id, teamId, assigneeUserId, title, category, priority, dueDate: dueDate || null, notes })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the assignment. Try again.")
    } finally { setIsSaving(false) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create assignment from submission</DialogTitle>
          <DialogDescription>
            {submission.fullName} · {submission.email}. {readyFiles.length} uploaded {readyFiles.length === 1 ? "file will" : "files will"} be attached as briefs. Client contact details will be saved in the notes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="submission-title">Assignment title</Label>
            <Input id="submission-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={isSaving} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="submission-team">Team</Label>
              <select id="submission-team" className={selectClassName} value={teamId} disabled={isSaving} required onChange={(event) => {
                const id = Number(event.target.value)
                setTeamId(id)
                const team = teams.find((item) => item.id === id)
                setAssigneeUserId(team?.members.find((member) => member.userId === userId)?.userId ?? team?.members[0]?.userId ?? "")
              }}>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="submission-assignee">Assignee</Label>
              <select id="submission-assignee" className={selectClassName} value={assigneeUserId} disabled={isSaving} required onChange={(event) => setAssigneeUserId(event.target.value)}>
                {selectedTeam?.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName || member.email}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="submission-type">Assignment type</Label>
              <select id="submission-type" className={selectClassName} value={category} disabled={isSaving} onChange={(event) => setCategory(event.target.value as typeof category)}>
                {assignmentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="submission-priority">Priority</Label>
              <select id="submission-priority" className={selectClassName} value={priority} disabled={isSaving} onChange={(event) => setPriority(event.target.value as typeof priority)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="submission-deadline">Deadline (optional)</Label>
            <Input id="submission-deadline" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="submission-notes">Notes (optional)</Label>
            <Textarea id="submission-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={10000} disabled={isSaving} />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !teamId || !assigneeUserId}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Creating assignment" : "Create assignment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
