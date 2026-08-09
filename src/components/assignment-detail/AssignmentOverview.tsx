import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Assignment } from "@/types"
export function AssignmentOverview({ assignment }: { assignment: Assignment }) { return <Card><CardHeader><CardTitle>Overview</CardTitle></CardHeader><CardContent className="grid gap-4"><div><p className="text-sm font-medium">Assignment brief</p><p className="mt-2 max-w-prose whitespace-pre-wrap leading-7 text-muted-foreground">{assignment.notes || "No notes added."}</p></div></CardContent></Card> }
