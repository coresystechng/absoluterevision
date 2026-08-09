import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import * as assignmentApi from "@/api/assignments"
import { getOrCreateUser } from "@/api/users"
import { AssignmentDialog } from "@/components/AssignmentDialog"
import { AssignmentFiles } from "@/components/AssignmentFiles"
import { DetailPageLayout } from "@/components/DetailPageLayout"
import { Navbar } from "@/components/Navbar"
import { StatePanel } from "@/components/StatePanel"
import { AssignmentActivity, type AssignmentActivityItem } from "@/components/assignment-detail/AssignmentActivity"
import { AssignmentOverview } from "@/components/assignment-detail/AssignmentOverview"
import { AssignmentPageHeader } from "@/components/assignment-detail/AssignmentPageHeader"
import { AssignmentTrackingPanel } from "@/components/assignment-detail/AssignmentTrackingPanel"
import { AssignmentWorkflowPanel } from "@/components/assignment-detail/AssignmentWorkflowPanel"
import { Skeleton } from "@/components/ui/skeleton"
import { useTeams } from "@/hooks/useTeams"
import { uploadAssignmentFileSelection } from "@/lib/assignment-file-uploads"
import { splitTrackingCode } from "@/lib/public-assignment-status"
import type { Assignment, AssignmentActivity as Activity, AssignmentFileUpload, AssignmentInput, AssignmentProgressStage, AssignmentStatus, AuthUser } from "@/types"

type LoadState = "loading" | "success" | "not-found" | "error"
function actorName(user: AuthUser) { return user.displayName?.trim() || user.email.split("@")[0] || "User" }
function activityItems(assignment: Assignment, activities: Activity[], name: string): AssignmentActivityItem[] {
  const values: AssignmentActivityItem[] = activities.some((item) => item.action === "created") ? activities : [{ id: "created", message: `${name} created the assignment`, createdAt: assignment.createdAt }, ...activities]
  return values.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function AssignmentView({ user, onSignOut }: { user: AuthUser; onSignOut: () => void | Promise<void> }) {
  const id = Number(useParams().id); const navigate = useNavigate(); const name = actorName(user)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const assignmentRef = useRef(assignment); assignmentRef.current = assignment
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [refreshing, setRefreshing] = useState(false)
  const [activityError, setActivityError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [filesVersion, setFilesVersion] = useState(0)
  const [workflowSaving, setWorkflowSaving] = useState(false)
  const [workflowError, setWorkflowError] = useState(false)
  const requestId = useRef(0); const workflowPending = useRef(false)
  const { members } = useTeams(user.id, assignment?.teamId ?? null)

  const refreshActivities = useCallback(async () => {
    if (!Number.isFinite(id)) return
    setActivityError(false)
    try { setActivities(await assignmentApi.getActivities(user.id, id)) } catch { setActivityError(true) }
  }, [id, user.id])

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return
    const token = ++requestId.current; const same = assignmentRef.current?.id === id
    if (same) setRefreshing(true); else { assignmentRef.current = null; setAssignment(null); setActivities([]); setLoadState("loading") }
    try {
      await getOrCreateUser(user); const result = await assignmentApi.getById(user.id, id)
      if (token !== requestId.current) return
      if (!result) { setLoadState("not-found"); return }
      setAssignment(result); setLoadState("success"); setActivityError(false)
      try { const resultActivities = await assignmentApi.getActivities(user.id, id); if (token === requestId.current) setActivities(resultActivities) } catch { if (token === requestId.current) setActivityError(true) }
    } catch { if (token === requestId.current && !assignmentRef.current) setLoadState("error") }
    finally { if (token === requestId.current) setRefreshing(false) }
  }, [id, user])
  useEffect(() => { void load(); return () => { requestId.current += 1 } }, [load])

  if (!Number.isFinite(id)) return <Navigate to="/dashboard" replace />

  const uploadFiles = async (files: AssignmentFileUpload[]) => {
    if (!files.length) return false
    const result = await uploadAssignmentFileSelection({ userId: user.id, actorName: name, assignmentId: id, files })
    if (result.uploaded) setFilesVersion((value) => value + 1)
    return result.failed > 0
  }
  const updateAssignment = async (input: AssignmentInput, files: AssignmentFileUpload[]) => {
    const updated = await assignmentApi.update(user.id, id, input, name)
    if (updated) { setAssignment(updated); const fileUploadFailed = await uploadFiles(files); await refreshActivities(); return { fileUploadFailed } }
  }
  const mutateWorkflow = async (request: () => Promise<Assignment | null>, message: string) => {
    if (workflowPending.current) return
    workflowPending.current = true; setWorkflowSaving(true); setWorkflowError(false)
    try { const updated = await request(); if (!updated) throw new Error("Not accepted"); setAssignment(updated); await refreshActivities(); toast.success(message) }
    catch { setWorkflowError(true); toast.error("Something went wrong. Try again.") }
    finally { workflowPending.current = false; setWorkflowSaving(false) }
  }
  const deleteAssignment = async () => { try { await assignmentApi.remove(user.id, id); toast.success("Assignment deleted"); navigate("/dashboard") } catch (error) { toast.error("Something went wrong. Try again."); throw error } }
  const copyDetails = async () => { const value = assignment && splitTrackingCode(assignment.trackingCode); if (!value) return; try { await navigator.clipboard.writeText(`Reference: ${value.reference}\nAccess code: ${value.accessCode}`); toast.success("Tracking details copied") } catch { toast.error("Could not copy the tracking details") } }
  const copyLink = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/track-assignment`); toast.success("Tracking link copied") } catch { toast.error("Could not copy the tracking link") } }

  const canManage = assignment?.currentUserRole === "admin"
  const tracking = assignment ? splitTrackingCode(assignment.trackingCode) : null
  const canUseFiles = Boolean(assignment && (canManage || assignment.assigneeUserId === user.id))
  return <div className="min-h-screen bg-background"><Navbar user={user} onSignOut={onSignOut} activeTeamName={loadState === "loading" ? undefined : assignment?.teamName ?? null} />
    {loadState === "loading" ? <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-96" /></main>
      : loadState === "error" ? <main className="mx-auto max-w-6xl px-4 py-6"><StatePanel context="page" tone="error" title="Could not load this assignment" description="The assignment could not be loaded right now." primaryAction={{ label: "Try again", onClick: () => void load() }} secondaryAction={{ label: "Back to dashboard", onClick: () => navigate("/dashboard") }} live="assertive" /></main>
      : loadState === "not-found" || !assignment ? <main className="mx-auto max-w-6xl px-4 py-6"><StatePanel context="page" title="Assignment not found" description="This assignment does not exist or you do not have access to it." primaryAction={{ label: "Back to dashboard", onClick: () => navigate("/dashboard") }} /></main>
      : <div aria-busy={refreshing || undefined}><DetailPageLayout
          header={<AssignmentPageHeader assignment={assignment} canManage={canManage} onEdit={() => setEditing(true)} onDelete={deleteAssignment} />}
          primary={<><AssignmentOverview assignment={assignment} /><AssignmentFiles key={`${assignment.id}-${filesVersion}`} assignmentId={assignment.id} user={user} actorName={name} onActivityChange={refreshActivities} canUpload={canUseFiles} allowedCategories={canManage ? undefined : ["final"]} canDownload={canUseFiles} canDelete={canManage} /><AssignmentActivity items={activityItems(assignment, activities, name)} error={activityError} onRetry={() => void refreshActivities()} /></>}
          rail={<><AssignmentWorkflowPanel assignment={assignment} canManage={canManage} saving={workflowSaving} error={workflowError} onStatus={(value: AssignmentStatus) => void mutateWorkflow(() => assignmentApi.updateStatus(user.id, id, value, name), value === "completed" ? "Marked as complete" : "Assignment updated")} onProgress={(value: AssignmentProgressStage) => void mutateWorkflow(() => assignmentApi.updateProgressStage(user.id, id, value, name), "Progress updated")} />{tracking ? <AssignmentTrackingPanel assignmentId={assignment.id} reference={tracking.reference} accessCode={tracking.accessCode} onCopyDetails={() => void copyDetails()} onCopyLink={() => void copyLink()} /> : null}<p className="text-xs text-muted-foreground">Created {new Date(assignment.createdAt).toLocaleString()}<br />Updated {new Date(assignment.updatedAt).toLocaleString()}</p></>}
        /><AssignmentDialog open={editing} onOpenChange={setEditing} assignment={assignment} teamId={assignment.teamId} teamMembers={members} canAssign={canManage} onSave={updateAssignment} /></div>}
  </div>
}
