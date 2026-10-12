import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Download, FileImage, FileText, Inbox, Loader2, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"

import { ClientSubmissionsError, convertClientSubmission, getClientSubmissionDownloadUrl, getClientSubmissions } from "@/api/client-submissions"
import { Navbar } from "@/components/Navbar"
import { StatePanel } from "@/components/StatePanel"
import { SubmissionConversionDialog } from "@/components/SubmissionConversionDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { AuthUser } from "@/types"
import type { ClientSubmission, ClientSubmissionsPage, SubmissionAssignmentInput } from "../../shared/client-submissions"

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
}

export function ClientSubmissions({ user, onSignOut }: { user: AuthUser; onSignOut: () => void | Promise<void> }) {
  const navigate = useNavigate()
  const [page, setPage] = useState<ClientSubmissionsPage | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("new")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selected, setSelected] = useState<ClientSubmission | null>(null)
  const [downloadKey, setDownloadKey] = useState<string | null>(null)
  const [downloadReady, setDownloadReady] = useState<{ key: string; url: string } | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async (cursor?: string | null) => {
    const token = ++requestId.current
    setIsLoading(true)
    setError(null)
    try {
      const result = await getClientSubmissions({ search, status, cursor })
      if (token !== requestId.current) return
      setPage((previous) => cursor && previous ? { ...result, submissions: [...previous.submissions, ...result.submissions] } : result)
    } catch (caught) {
      if (token === requestId.current) setError(caught instanceof Error ? caught : new Error("Could not load submissions."))
    } finally { if (token === requestId.current) setIsLoading(false) }
  }, [search, status])

  useEffect(() => { setPage(null); void load(); return () => { requestId.current += 1 } }, [load, user.id])

  const searchSubmissions = (event: FormEvent) => {
    event.preventDefault()
    if (search === searchInput.trim()) void load()
    else setSearch(searchInput.trim())
  }

  const download = async (submissionId: string, fileIndex: number) => {
    setDownloadKey(`${submissionId}-${fileIndex}`)
    const tab = window.open("about:blank", "_blank")
    if (tab) tab.opener = null
    try {
      const { url } = await getClientSubmissionDownloadUrl(submissionId, fileIndex)
      if (tab) tab.location.replace(url)
      else setDownloadReady({ key: `${submissionId}-${fileIndex}`, url })
    } catch (caught) {
      tab?.close()
      toast.error(caught instanceof Error ? caught.message : "Could not download this file.")
    }
    finally { setDownloadKey(null) }
  }

  const convert = async (input: SubmissionAssignmentInput) => {
    const { assignmentId } = await convertClientSubmission(input)
    setSelected(null)
    toast.success("Assignment created with the client's uploaded files.")
    navigate(`/assignments/${assignmentId}`)
  }

  const accessDenied = error instanceof ClientSubmissionsError && [401, 403].includes(error.status)
  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onSignOut={onSignOut} activeTeamName={null} canViewSubmissions={!accessDenied} />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3"><Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
            <h1 className="text-3xl font-semibold">Client submissions</h1>
            <p className="mt-2 text-sm text-muted-foreground">Review incoming documents and images, then assign the work to your team.</p>
          </div>
          {!accessDenied ? <Button variant="outline" onClick={() => void load()} disabled={isLoading}><RefreshCw className="h-4 w-4" />Refresh</Button> : null}
        </div>

        {!accessDenied ? (
          <form onSubmit={searchSubmissions} className="flex flex-col gap-3 sm:flex-row">
            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={200} placeholder="Search client name, email, or file" aria-label="Search client submissions" className="flex-1" />
            <select aria-label="Submission status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="new">New submissions</option><option value="converted">Converted to assignments</option><option value="all">All submissions</option>
            </select>
            <Button type="submit"><Search className="h-4 w-4" />Search</Button>
          </form>
        ) : null}

        {error ? (
          <StatePanel context="page" tone="error" title={accessDenied ? "Admin access required" : "Could not load submissions"} description={error.message} live="assertive" primaryAction={accessDenied ? { label: "Back to dashboard", onClick: () => navigate("/dashboard") } : { label: "Try again", onClick: () => void load() }} />
        ) : isLoading && !page ? (
          <div aria-busy="true" aria-label="Loading client submissions" className="grid gap-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : page?.submissions.length === 0 ? (
          <StatePanel icon={Inbox} title={search || status === "converted" ? "No matching submissions" : "No client submissions yet"} description={search ? "Try a different client name, email, or filename." : "New client uploads will appear here. Files uploaded before this inbox was introduced remain in Dropbox."} />
        ) : (
          <div className="grid gap-4" aria-busy={isLoading}>
            {page?.submissions.map((submission) => {
              const readyFiles = submission.files.filter((file) => file.status === "ready")
              const hasPending = submission.files.some((file) => file.status === "pending")
              return (
                <Card key={submission.id}>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-semibold">{submission.fullName}</h2>
                      <a href={`mailto:${submission.email}`} className="mt-1 block break-all text-sm text-muted-foreground underline underline-offset-4">{submission.email}</a>
                      <p className="mt-2 text-xs text-muted-foreground">Received {new Date(submission.submittedAt).toLocaleString()} · {readyFiles.length} of {submission.files.length} files uploaded</p>
                    </div>
                    <Badge variant={submission.convertedAt ? "secondary" : "outline"}>{submission.convertedAt ? "Assignment created" : hasPending ? "Uploading" : "New"}</Badge>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <ul className="grid gap-2" aria-label={`Files from ${submission.fullName}`}>
                      {submission.files.map((file) => {
                        const Icon = file.mimeType.startsWith("image/") ? FileImage : FileText
                        const key = `${submission.id}-${file.index}`
                        return (
                          <li key={file.index} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3"><Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="break-words text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}{file.status !== "ready" ? ` · ${file.status === "failed" ? "Upload failed" : "Waiting for upload"}` : ""}</p></div></div>
                            {file.status === "ready" ? (
                              <div className="flex shrink-0 gap-2">
                                {downloadReady?.key === key ? <Button asChild variant="outline" size="sm"><a href={downloadReady.url} target="_blank" rel="noopener noreferrer">Open file</a></Button> : null}
                                <Button variant="outline" size="sm" disabled={downloadKey !== null} aria-label={`Download ${file.name}`} onClick={() => void download(submission.id, file.index)}>{downloadKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download</Button>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                    {submission.convertedAt ? (
                      submission.assignmentId ? <Button asChild className="w-fit"><Link to={`/assignments/${submission.assignmentId}`}>Open assignment</Link></Button> : <p className="text-sm text-muted-foreground">The assignment was removed.</p>
                    ) : (
                      <div className="flex flex-col gap-2 sm:items-end">
                        {hasPending ? <p className="text-sm text-muted-foreground">Refresh after the client finishes uploading.</p> : submission.files.some((file) => file.status === "failed") ? <p className="text-sm text-muted-foreground">Only successfully uploaded files will be attached.</p> : null}
                        {page.teams.length === 0 ? <p className="text-sm text-muted-foreground">Create a team you manage before converting submissions.</p> : null}
                        <Button className="w-full sm:w-auto" disabled={readyFiles.length === 0 || hasPending || page.teams.length === 0 || isLoading} onClick={() => setSelected(submission)}>Create assignment</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {page?.nextCursor ? <Button variant="outline" disabled={isLoading} onClick={() => void load(page.nextCursor)}>{isLoading ? "Loading" : "Load more submissions"}</Button> : null}
          </div>
        )}
      </main>
      {selected && page ? <SubmissionConversionDialog key={selected.id} submission={selected} teams={page.teams} userId={user.id} onClose={() => setSelected(null)} onConvert={convert} /> : null}
    </div>
  )
}
