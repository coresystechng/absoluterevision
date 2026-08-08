import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ThemeToggle } from "@/components/ThemeToggle"
import { ThemeProvider } from "@/hooks/useTheme"
import { renderWithRouter } from "@/test/render"

describe("ThemeToggle", () => {
  it("exposes every preference and persists the selected theme", async () => {
    const { user } = renderWithRouter(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const light = screen.getByRole("button", { name: "Light" })
    const dark = screen.getByRole("button", { name: "Dark" })
    const system = screen.getByRole("button", { name: "System" })

    expect(light).toHaveAttribute("aria-pressed", "false")
    expect(dark).toHaveAttribute("aria-pressed", "false")
    expect(system).toHaveAttribute("aria-pressed", "true")

    await user.click(dark)

    expect(dark).toHaveAttribute("aria-pressed", "true")
    expect(system).toHaveAttribute("aria-pressed", "false")
    await waitFor(() => expect(window.localStorage.getItem("absolute-revision-theme")).toBe("dark"))
  })
})
