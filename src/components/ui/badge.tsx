import * as React from "react"
import { type VariantProps, cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        destructive: "border-transparent bg-destructive text-primary-foreground",
        success: "border-success-border bg-success-background text-success-foreground",
        warning: "border-warning-border bg-warning-background text-warning-foreground",
        danger: "border-danger-border bg-danger-background text-danger-foreground",
        info: "border-info-border bg-info-background text-info-foreground",
        neutral: "border-neutral-border bg-neutral-background text-neutral-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
