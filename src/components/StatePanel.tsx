import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Action = { label: string; onClick: () => void; disabled?: boolean }

const toneClasses = {
  neutral: "border-border bg-card text-foreground",
  info: "border-info-border bg-info-background text-info-foreground",
  warning: "border-warning-border bg-warning-background text-warning-foreground",
  error: "border-danger-border bg-danger-background text-danger-foreground",
  success: "border-success-border bg-success-background text-success-foreground",
}

const contextClasses = {
  page: "min-h-64 justify-center px-6 py-12 text-center",
  section: "px-6 py-8 text-center",
  inline: "px-4 py-4",
}

export function StatePanel({
  context = "section",
  tone = "neutral",
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  live,
}: {
  context?: keyof typeof contextClasses
  tone?: keyof typeof toneClasses
  icon?: LucideIcon
  title: string
  description?: string
  primaryAction?: Action
  secondaryAction?: Action
  live?: "polite" | "assertive"
}) {
  return (
    <section
      className={cn("flex min-w-0 flex-col rounded-md border", toneClasses[tone], contextClasses[context])}
      role={live === "assertive" ? "alert" : undefined}
      aria-live={live === "polite" ? "polite" : undefined}
      aria-atomic={live ? "true" : undefined}
    >
      {Icon ? <Icon className={cn("mb-3 h-6 w-6", context !== "inline" && "mx-auto")} aria-hidden="true" /> : null}
      <h2 className={cn("font-semibold", context === "page" ? "text-xl" : "text-base")}>{title}</h2>
      {description ? <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {primaryAction || secondaryAction ? (
        <div className={cn("mt-4 flex flex-wrap gap-2", context !== "inline" && "justify-center")}>
          {primaryAction ? <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</Button> : null}
          {secondaryAction ? <Button variant="outline" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>{secondaryAction.label}</Button> : null}
        </div>
      ) : null}
    </section>
  )
}
