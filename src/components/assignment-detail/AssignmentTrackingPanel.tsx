import { Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AssignmentTrackingPanel({ assignmentId, reference, accessCode, onCopyDetails, onCopyLink }: { assignmentId: number; reference: string; accessCode: string; onCopyDetails: () => void; onCopyLink: () => void }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { setRevealed(false); return () => setRevealed(false) }, [assignmentId])
  return <Card><CardHeader><CardTitle>Client tracking</CardTitle></CardHeader><CardContent className="grid min-w-0 gap-4"><p className="text-sm text-muted-foreground">Share both private details only with the intended client. The tracking page URL contains no credentials.</p><dl className="grid min-w-0 gap-3"><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Reference</dt><dd className="mt-1 font-mono text-sm font-medium">{reference}</dd></div><div className="min-w-0"><dt className="text-xs uppercase tracking-wide text-muted-foreground">Access code</dt><dd className="mt-1 break-all font-mono text-sm font-medium">{revealed ? accessCode : "••••••-••••••-••••••"}</dd><Button type="button" variant="ghost" size="sm" className="mt-1 px-0" onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide access code" : "Reveal access code"}</Button><span className="sr-only" aria-live="polite">Access code is {revealed ? "visible" : "hidden"}.</span></div></dl><div className="grid gap-2"><Button variant="outline" onClick={onCopyDetails}><Copy className="h-4 w-4" />Copy tracking details</Button><Button variant="outline" onClick={onCopyLink}><Copy className="h-4 w-4" />Copy clean tracking link</Button></div></CardContent></Card>
}
