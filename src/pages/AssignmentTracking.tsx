import { type FormEvent, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, Circle, Loader2, Mail, Phone } from "lucide-react"

import { getPublicAssignmentStatus, PublicAssignmentStatusError, type PublicAssignmentStatus } from "@/api/public-assignment-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { getProgressPresentation, getStatusPresentation } from "@/lib/assignment-presentation"
import {
  formatPublicDueDate,
  getPublicMilestones,
  getPublicProgress,
  getPublicStageDetails,
  getPublicStatusLabel,
  normalizeTrackingAccessCode,
  normalizeTrackingReference,
} from "@/lib/public-assignment-status"

import logoImage from "../../img/icon.png"

const supportEmail = "support@absoluterevision.com"
const phoneDisplay = "+1 937 249 0400"
const phoneHref = "tel:+19372490400"

type ViewState = "initial" | "loading" | "success" | "not-found" | "rate-limited" | "error"

export function AssignmentTracking() {
  const [reference, setReference] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [state, setState] = useState<ViewState>("initial")
  const [assignment, setAssignment] = useState<PublicAssignmentStatus | null>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedReference = normalizeTrackingReference(reference)
    const normalizedAccessCode = normalizeTrackingAccessCode(accessCode)
    if (!normalizedReference || !normalizedAccessCode) {
      setAssignment(null)
      setState("not-found")
      return
    }

    setReference(normalizedReference)
    setAccessCode(normalizedAccessCode)
    setState("loading")
    setAssignment(null)
    try {
      const result = await getPublicAssignmentStatus(normalizedReference, normalizedAccessCode)
      setAssignment(result)
      setAccessCode("")
      setState("success")
      window.setTimeout(() => resultsHeading.current?.focus(), 0)
    } catch (error) {
      setState(error instanceof PublicAssignmentStatusError && error.kind !== "unavailable" ? error.kind : "error")
    }
  }

  const milestones = assignment ? getPublicMilestones(assignment) : []
  const progress = assignment ? getPublicProgress(assignment.status, assignment.progressStage) : 0
  const statusPresentation = assignment ? getStatusPresentation(assignment.status) : null
  const progressPresentation = assignment ? getProgressPresentation(assignment.status, assignment.progressStage) : null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-semibold"><img src={logoImage} alt="" className="h-8 w-8 shrink-0 object-contain" /><span className="truncate">Absolute Revision</span></Link>
          <div className="flex shrink-0 gap-2"><Button variant="ghost" size="sm" asChild><Link to="/">Home</Link></Button><Button size="sm" asChild><Link to="/document-upload">Submit manuscript</Link></Button></div>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:py-16">
        <section className="grid gap-3">
          <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Check your assignment progress</h1>
          <p className="text-muted-foreground">Enter the reference and private access code supplied by our team.</p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Track assignment</CardTitle>
            <CardDescription>Both details are required. They are checked securely and are never added to the page URL.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tracking-reference">Assignment reference</Label>
                <Input id="tracking-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="AR-902AF8" autoComplete="off" spellCheck={false} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tracking-access-code">Access code</Label>
                <Input id="tracking-access-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="7A91F2-88C4D0-1B6E35" autoComplete="off" spellCheck={false} required />
              </div>
              <Button type="submit" disabled={state === "loading"} className="sm:col-span-2">
                {state === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" />Checking</> : "Check progress"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div aria-live="polite" aria-atomic="true">
          {state === "loading" ? <Card><CardContent className="flex items-center gap-3 p-6"><Loader2 className="h-5 w-5 animate-spin" />Checking your assignment…</CardContent></Card> : null}
          {state === "not-found" ? <Card><CardContent className="p-6 text-muted-foreground">We could not verify those details. Check both values and try again.</CardContent></Card> : null}
          {state === "rate-limited" ? <Card><CardContent className="p-6 text-muted-foreground">Too many requests. Please wait a moment and try again.</CardContent></Card> : null}
          {state === "error" ? <Card><CardContent className="p-6 text-muted-foreground">Tracking is temporarily unavailable. Please try again later.</CardContent></Card> : null}
          {assignment && state === "success" ? (
            <Card>
              <CardHeader className="gap-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-1">
                    <CardTitle tabIndex={-1} ref={resultsHeading}>{assignment.category ?? "Service"}</CardTitle>
                    <CardDescription>Reference {assignment.reference}</CardDescription>
                  </div>
                  <Badge variant={statusPresentation!.tone} className="w-fit">{getPublicStatusLabel(assignment.status)}</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid gap-2">
                    <div className="flex justify-between gap-4 text-sm font-medium">
                      <span>{getPublicStageDetails(assignment.progressStage).label}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} tone={progressPresentation!.tone} aria-label="Assignment progress" />
                  </div>
                  <div className="sm:min-w-40 sm:text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
                    <p className="mt-1 font-medium">{formatPublicDueDate(assignment.dueDate)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6">
                <Separator />
                <ol className="grid gap-2">
                  {milestones.map((milestone) => {
                    const isCurrent = milestone.state === "current"
                    const isUpcoming = milestone.state === "upcoming"
                    const Icon = isUpcoming ? Circle : CheckCircle2
                    return (
                      <li key={milestone.value} className={`flex gap-3 rounded-md px-2 py-2 ${isCurrent ? "bg-muted/70" : ""} ${isUpcoming ? "text-muted-foreground" : ""}`}>
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${milestone.state === "complete" ? "text-success-foreground" : isCurrent ? "stroke-[2.5] text-foreground" : "text-muted-foreground"}`} />
                        <div>
                          <p className={isCurrent ? "font-semibold" : milestone.state === "complete" ? "font-medium" : "font-normal"}>{milestone.label}</p>
                          <p className="text-sm text-muted-foreground">{milestone.description}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {assignment.status === "completed" ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Your completed work will be delivered through the agreed channel.</p> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card><CardContent className="grid gap-3 p-6 text-sm text-muted-foreground sm:grid-cols-2"><a className="flex items-center gap-2 hover:text-foreground" href={`mailto:${supportEmail}`}><Mail className="h-4 w-4" />{supportEmail}</a><a className="flex items-center gap-2 hover:text-foreground" href={phoneHref}><Phone className="h-4 w-4" />{phoneDisplay}</a></CardContent></Card>
      </main>
    </div>
  )
}
