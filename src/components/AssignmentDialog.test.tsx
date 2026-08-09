import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AssignmentDialog } from "@/components/AssignmentDialog"

describe("AssignmentDialog", () => {
  it("labels every select by its visible label", () => {
    render(<AssignmentDialog open onOpenChange={vi.fn()} teamId={1} canAssign teamMembers={[{ id: 1, teamId: 1, userId: "u", email: "u@example.com", displayName: "User", role: "admin", createdAt: "2026-01-01" }]} onSave={vi.fn()} />)
    for (const name of ["Type", "Assignee", "Priority", "Status", "Progress", "File category"]) {
      expect(screen.getByRole("combobox", { name })).toBeVisible()
    }
  })
})
