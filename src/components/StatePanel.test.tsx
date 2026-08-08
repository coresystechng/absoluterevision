import { screen } from "@testing-library/react"
import { AlertCircle } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { StatePanel } from "@/components/StatePanel"
import { renderWithRouter } from "@/test/render"

describe("StatePanel", () => {
  const toneClasses = {
    neutral: ["border-border", "bg-card"],
    info: ["border-info-border", "bg-info-background"],
    warning: ["border-warning-border", "bg-warning-background"],
    error: ["border-danger-border", "bg-danger-background"],
    success: ["border-success-border", "bg-success-background"],
  } as const

  it.each(Object.keys(toneClasses) as Array<keyof typeof toneClasses>)("renders the %s tone accessibly", (tone) => {
    renderWithRouter(<StatePanel tone={tone} icon={AlertCircle} title={`${tone} title`} description="Useful detail" live="polite" />)
    expect(screen.getByRole("heading", { name: `${tone} title` })).toBeVisible()
    expect(screen.getByText("Useful detail")).toBeVisible()
    const panel = screen.getByText("Useful detail").closest("section")
    expect(panel).toHaveAttribute("aria-live", "polite")
    expect(panel).toHaveClass(...toneClasses[tone])
  })

  it.each(["page", "section", "inline"] as const)("supports the %s context and actions", async (context) => {
    const primary = vi.fn()
    const secondary = vi.fn()
    const { user } = renderWithRouter(<StatePanel context={context} title="Recover" primaryAction={{ label: "Retry", onClick: primary }} secondaryAction={{ label: "Back", onClick: secondary }} />)
    await user.click(screen.getByRole("button", { name: "Retry" }))
    await user.click(screen.getByRole("button", { name: "Back" }))
    expect(primary).toHaveBeenCalledOnce()
    expect(secondary).toHaveBeenCalledOnce()
  })
})
