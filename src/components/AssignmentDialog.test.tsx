import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AssignmentDialog } from "@/components/AssignmentDialog"
import type { Assignment } from "@/types"

const designAssignment: Assignment = {
  id: 42,
  trackingCode: "AR-7A91F2-88C4D0-1B6E35-902AF8",
  userId: "u",
  teamId: 1,
  teamName: "Team",
  currentUserRole: "admin",
  assigneeUserId: "u",
  assigneeName: "User",
  assigneeEmail: "u@example.com",
  title: "Brand identity",
  category: "Design",
  priority: "medium",
  status: "ongoing",
  progressStage: "drafts",
  dueDate: null,
  dueTime: null,
  progress: 30,
  notes: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("AssignmentDialog", () => {
  it("labels every select by its visible label", () => {
    render(<AssignmentDialog open onOpenChange={vi.fn()} teamId={1} canAssign teamMembers={[{ id: 1, teamId: 1, userId: "u", email: "u@example.com", displayName: "User", role: "admin", createdAt: "2026-01-01" }]} onSave={vi.fn()} />)
    for (const name of ["Type", "Assignee", "Priority", "Status", "Progress", "File category"]) {
      expect(screen.getByRole("combobox", { name })).toBeVisible()
    }
  })

  it("shows the Design-specific current progress stage", () => {
    render(<AssignmentDialog open onOpenChange={vi.fn()} assignment={designAssignment} onSave={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("Design")
    expect(screen.getByRole("combobox", { name: "Progress" })).toHaveTextContent("Drafts")
  })

})
