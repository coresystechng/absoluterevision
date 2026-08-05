import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CheckCircle2, Loader2, Mail, Phone } from "lucide-react"

import { getPublicAssignmentStatus, PublicAssignmentStatusError, type PublicAssignmentStatus } from "@/api/public-assignment-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  formatPublicDueDate,
  formatPublicUpdatedAt,
  getPublicMilestones,
  getPublicProgress,
  getPublicStageDetails,
  getPublicStatusLabel,
  normalizeTrackingCode,
} from "@/lib/public-assignment-status"

import logoImage from "../../img/icon.png"

const supportEmail = "support@absoluterevision.com"
const phoneDisplay = "+1 937 249 0400"
const phoneHref = "tel:+19372490400"

type ViewState = "initial" | "loading" | "success" | "not-found" | "rate-limited" | "error"

export function AssignmentTracking() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [trackingId, setTrackingId] = useState(() => searchParams.get("trackingId") ?? "")
  const [state, setState] = useState<ViewState>("initial")
  const [assignment, setAssignment] = useState<PublicAssignmentStatus | null>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const autoSubmitted = useRef(false)

  const lookUp = useCallback(async (value: string, updateUrl: boolean) => {
    const normalized = normalizeTrackingCode(value)
    if (!normalized) {
      setAssignment(null)
      setState("not-found")
      return
    }
    setTrackingId(normalized)
    setState("loading")
    setAssignment(null)
    try {
      const result = await getPublicAssignmentStatus(normalized)
      setAssignment(result)
      setState("success")
      if (updateUrl) setSearchParams({ trackingId: normalized })
      window.setTimeout(() => resultsHeading.current?.focus(), 0)
    } catch (error) {
      setState(
        error instanceof PublicAssignmentStatusError && error.kind !== "unavailable"
          ? error.kind
          : "error",
      )
    }
  }, [setSearchParams])

  useEffect(() => {
    const fromUrl = searchParams.get("trackingId")
    if (!autoSubmitted.current && fromUrl && normalizeTrackingCode(fromUrl)) {
      autoSubmitted.current = true
      void lookUp(fromUrl, false)
    }
  }, [lookUp, searchParams])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void lookUp(trackingId, true)
  }
  const milestones = assignment ? getPublicMilestones(assignment) : []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-semibold"><img src={logoImage} alt="" className="h-8 w-8 shrink-0 object-contain" /><span className="truncate">Absolute Revision</span></Link>
          <div className="flex shrink-0 gap-2"><Button variant="ghost" size="sm" asChild><Link to="/">Home</Link></Button><Button size="sm" asChild><Link to="/document-upload">Submit manuscript</Link></Button></div>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:py-16">
        <section className="grid gap-3"><h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Check your assignment progress</h1><p className="text-muted-foreground">Enter the Assignment ID supplied by our team to view your service progress.</p></section>
        <Card>
          <CardHeader><CardTitle>Assignment ID</CardTitle><CardDescription>Your team supplies this private tracking ID.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3">
              <Label htmlFor="tracking-id">Assignment ID</Label>
              <Input id="tracking-id" value={trackingId} onChange={(event) => setTrackingId(event.target.value)} placeholder="AR-7A91F2-88C4D0-1B6E35-902AF8" autoComplete="off" spellCheck={false} />
              <Button type="submit" disabled={state === "loading"}>{state === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" />Checking</> : "Check progress"}</Button>
            </form>
          </CardContent>
        </Card>
        <div aria-live="polite" aria-atomic="true">
          {state === "loading" ? <Card><CardContent className="flex items-center gap-3 p-6"><Loader2 className="h-5 w-5 animate-spin" />Checking your assignment…</CardContent></Card> : null}
          {state === "not-found" ? <Card><CardContent className="p-6 text-muted-foreground">Assignment not found. Check the ID and try again.</CardContent></Card> : null}
          {state === "rate-limited" ? <Card><CardContent className="p-6 text-muted-foreground">Too many requests. Please wait a moment and try again.</CardContent></Card> : null}
          {state === "error" ? <Card><CardContent className="p-6 text-muted-foreground">Tracking is temporarily unavailable. Please try again later.</CardContent></Card> : null}
          {assignment && state === "success" ? <Card>
            <CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle tabIndex={-1} ref={resultsHeading}>Your assignment progress</CardTitle><Badge>{getPublicStatusLabel(assignment.status)}</Badge></div><CardDescription>{assignment.category ?? "Service"} · Last updated {formatPublicUpdatedAt(assignment.updatedAt)}</CardDescription></CardHeader>
            <CardContent className="grid gap-6"><div className="grid gap-2"><p className="text-sm text-muted-foreground">Assignment ID</p><p className="break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">{assignment.trackingCode}</p></div><div className="grid gap-2"><div className="flex justify-between gap-4 text-sm"><span>{getPublicStageDetails(assignment.progressStage).label}</span><span>{getPublicProgress(assignment.status, assignment.progressStage)}%</span></div><Progress value={getPublicProgress(assignment.status, assignment.progressStage)} aria-label="Assignment progress" /></div><div className="grid gap-3"><p className="text-sm text-muted-foreground">Due date</p><p className="font-medium">{formatPublicDueDate(assignment.dueDate)}</p></div><Separator /><ol className="grid gap-3">{milestones.map((milestone) => <li key={milestone.value} className="flex gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${milestone.state === "complete" ? "text-primary" : milestone.state === "current" ? "text-foreground" : "text-muted-foreground"}`} /><div><p className="font-medium">{milestone.label}</p><p className="text-sm text-muted-foreground">{milestone.description}</p></div></li>)}</ol>{assignment.status === "completed" ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Your completed work will be delivered through the agreed channel.</p> : null}</CardContent>
          </Card> : null}
        </div>
        <Card><CardContent className="grid gap-3 p-6 text-sm text-muted-foreground sm:grid-cols-2"><a className="flex items-center gap-2 hover:text-foreground" href={`mailto:${supportEmail}`}><Mail className="h-4 w-4" />{supportEmail}</a><a className="flex items-center gap-2 hover:text-foreground" href={phoneHref}><Phone className="h-4 w-4" />{phoneDisplay}</a></CardContent></Card>
      </main>
    </div>
  )
}
