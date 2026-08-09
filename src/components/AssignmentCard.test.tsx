import { screen } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { AssignmentCard } from "@/components/AssignmentCard"
import { renderWithRouter } from "@/test/render"
import type { Assignment } from "@/types"

vi.mock("@/components/AssignmentDialog", () => ({ AssignmentDialog: () => null }))

const assignment: Assignment = { id: 42, trackingCode: "code", userId: "u", teamId: 1, teamName: "Team", currentUserRole: "admin", assigneeUserId: "u", assigneeName: "User", assigneeEmail: "u@example.com", title: "Research brief", category: "Assignment", priority: "high", status: "ongoing", progressStage: "humaned", dueDate: null, dueTime: null, progress: 30, notes: "Notes", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }

function renderCard() {
  return renderWithRouter(<Routes><Route path="/" element={<AssignmentCard assignment={assignment} onUpdate={vi.fn()} onDelete={vi.fn()} />} /><Route path="/assignments/:id" element={<h1>Assignment destination</h1>} /></Routes>)
}

describe("AssignmentCard interaction contract", () => {
  it("exposes a semantic assignment link and separate menu tab stop", async () => {
    const { user } = renderCard()
    const link = screen.getByRole("link", { name: "Open Research brief" })
    const menu = screen.getByRole("button", { name: "More actions for Research brief" })
    expect(link).toHaveAttribute("href", "/assignments/42")
    expect(link).not.toContainElement(menu)
    link.focus(); await user.keyboard("{Enter}")
    expect(await screen.findByRole("heading", { name: "Assignment destination" })).toBeVisible()
  })

  it("opens and closes the menu without navigation and restores focus", async () => {
    const { user } = renderCard()
    const menu = screen.getByRole("button", { name: "More actions for Research brief" })
    menu.focus(); await user.keyboard("{Enter}")
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "Assignment destination" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(menu).toHaveFocus()
    await user.keyboard(" ")
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeVisible()
  })
})
