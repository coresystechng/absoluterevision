import { Link } from "react-router-dom"
import { BarChart3, CheckCircle2, Flag, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    title: "Track every assignment",
    description: "Keep coursework, revision tasks, and deadlines in one focused workspace.",
    icon: CheckCircle2,
  },
  {
    title: "Prioritize the right work",
    description: "Sort by urgency, deadline, and status so the next action is always clear.",
    icon: Flag,
  },
  {
    title: "Monitor progress",
    description: "Use progress indicators and completion states to see momentum at a glance.",
    icon: BarChart3,
  },
]

export function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-[78vh] max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Assignment tracking for serious revision
          </div>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
            Absolute Revision
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Plan assignments, manage priorities, and keep progress visible before deadlines become urgent.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/sign-up">Get started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden rounded-lg border bg-muted sm:min-h-[420px] lg:min-h-[560px]">
          <img
            src="/img/hero-students.jpg"
            alt="Students revising together at a desk"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title}>
                <CardContent className="p-6">
                  <Icon className="h-5 w-5 text-foreground" />
                  <h2 className="mt-5 text-lg font-semibold">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-muted-foreground">
        <span>Absolute Revision</span>
        <span>Built for focused study workflows.</span>
      </footer>
    </main>
  )
}
