import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import * as assignmentApi from "@/api/assignments"
import { useAssignment } from "@/hooks/useAssignment"
import { useWorkspace } from "@/hooks/useWorkspace"
import { confirmAssignmentRemoval, reconcileAssignment } from "@/lib/workspace-cache"
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

function actorName(user: AuthUser) { return user.displayName?.trim() || user.email.split("@")[0] || "User" }
function activityItems(assignment: Assignment, activities: Activity[], name: string): AssignmentActivityItem[] {
  const values: AssignmentActivityItem[] = activities.some((item) => item.action === "created") ? activities : [{ id: "created", message: `${name} created the assignment`, createdAt: assignment.createdAt }, ...activities]
  return values.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function AssignmentView({ user, onSignOut }: { user: AuthUser; onSignOut: () => void | Promise<void> }) {
  const id = Number(useParams().id); const navigate = useNavigate(); const name = actorName(user)
  const { client } = useWorkspace()
  const detail = useAssignment(user.id, id)
  const assignment = detail.data ?? null
  const loadState = detail.isPending ? "loading" : detail.isError && !assignment ? "error" : !assignment ? "not-found" : "success"
  const refreshing = detail.isFetching && detail.data !== undefined
  const load = detail.refetch
  const [activities, setActivities] = useState<Activity[]>([])
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

  const hasAssignment = Boolean(assignment)
  useEffect(() => {
    if (!hasAssignment) return
    const token = ++requestId.current
    setActivities([])
    setActivityError(false)
    void assignmentApi.getActivities(user.id, id).then((values) => { if (token === requestId.current) setActivities(values) }).catch(() => { if (token === requestId.current) setActivityError(true) })
    return () => { requestId.current += 1 }
  }, [id, user.id, hasAssignment])

  if (!Number.isInteger(id) || id <= 0) return <Navigate to="/dashboard" replace />

  const uploadFiles = async (files: AssignmentFileUpload[]) => {
    if (!files.length) return false
    const result = await uploadAssignmentFileSelection({ userId: user.id, actorName: name, assignmentId: id, files })
    if (result.uploaded) setFilesVersion((value) => value + 1)
    return result.failed > 0
  }
  const updateAssignment = async (input: AssignmentInput, files: AssignmentFileUpload[]) => {
    const updated = await assignmentApi.update(user.id, id, input, name)
    await reconcileAssignment(client, user.id, updated)
    if (updated) { const fileUploadFailed = await uploadFiles(files); await refreshActivities(); return { fileUploadFailed } }
  }
  const mutateWorkflow = async (request: () => Promise<Assignment | null>, message: string) => {
    if (workflowPending.current) return
    workflowPending.current = true; setWorkflowSaving(true); setWorkflowError(false)
    try { const updated = await request(); if (!updated) throw new Error("Not accepted"); await reconcileAssignment(client, user.id, updated); await refreshActivities(); toast.success(message) }
    catch { setWorkflowError(true); toast.error("Something went wrong. Try again.") }
    finally { workflowPending.current = false; setWorkflowSaving(false) }
  }
  const deleteAssignment = async () => { try { await confirmAssignmentRemoval(client, user.id, id); toast.success("Assignment removed or unavailable"); navigate("/dashboard") } catch (error) { toast.error("Something went wrong. Try again."); throw error } }
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
          rail={<><AssignmentWorkflowPanel assignment={assignment} canManage={canManage} saving={workflowSaving} error={workflowError} onStatus={(value: AssignmentStatus) => void mutateWorkflow(() => assignmentApi.updateStatus(user.id, id, value, name), value === "completed" ? "Marked as complete" : "Assignment updated")} onProgress={(value: AssignmentProgressStage) => void mutateWorkflow(() => assignmentApi.updateProgressStage(user.id, id, value, name), "Progress updated")} />{canManage && tracking ? <AssignmentTrackingPanel assignmentId={assignment.id} reference={tracking.reference} accessCode={tracking.accessCode} onCopyDetails={() => void copyDetails()} onCopyLink={() => void copyLink()} /> : null}<p className="text-xs text-muted-foreground">Created {new Date(assignment.createdAt).toLocaleString()}<br />Updated {new Date(assignment.updatedAt).toLocaleString()}</p></>}
        /><AssignmentDialog open={editing} onOpenChange={setEditing} assignment={assignment} teamId={assignment.teamId} teamMembers={members} canAssign={canManage} onSave={updateAssignment} /></div>}
  </div>
}
