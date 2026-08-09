import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { Navbar } from "@/components/Navbar"
import { ThemeProvider } from "@/hooks/useTheme"

describe("Navbar", () => {
  it("exposes and cycles the compact theme control", async () => {
    window.localStorage.setItem("absolute-revision-theme", "light")
    const user = userEvent.setup()
    render(<ThemeProvider><MemoryRouter><Navbar user={{ id: "u", email: "u@example.com", displayName: "User" }} onSignOut={() => undefined} /></MemoryRouter></ThemeProvider>)
    const toggle = screen.getByRole("button", { name: "Theme: light. Switch to Dark" })
    await user.click(toggle)
    expect(screen.getByRole("button", { name: "Theme: dark. Switch to System" })).toBeVisible()
  })
})
