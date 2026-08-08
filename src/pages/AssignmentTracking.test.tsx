import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { getPublicAssignmentStatus, PublicAssignmentStatusError } from "@/api/public-assignment-status"
import { AssignmentTracking } from "@/pages/AssignmentTracking"
import { renderWithRouter } from "@/test/render"

vi.mock("@/api/public-assignment-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/public-assignment-status")>()
  return { ...actual, getPublicAssignmentStatus: vi.fn() }
})

const getStatusMock = vi.mocked(getPublicAssignmentStatus)
const validReference = "AR-902AF8"
const validAccessCode = "7A91F2-88C4D0-1B6E35"
const assignment = {
  reference: validReference,
  category: "Dissertation" as const,
  status: "ongoing" as const,
  progressStage: "humaned" as const,
  progress: 35,
  dueDate: "2026-09-01",
}

async function enterValidDetails(user: ReturnType<typeof import("@testing-library/user-event").default.setup>) {
  await user.type(screen.getByLabelText("Assignment reference"), validReference)
  await user.type(screen.getByLabelText("Access code"), validAccessCode)
}

describe("AssignmentTracking", () => {
  beforeEach(() => getStatusMock.mockReset())

  it("labels the form and safely rejects malformed tracking details", async () => {
    const { user } = renderWithRouter(<AssignmentTracking />, { initialEntries: ["/track-assignment"] })

    expect(screen.getByLabelText("Assignment reference")).toBeRequired()
    expect(screen.getByLabelText("Access code")).toBeRequired()

    await user.type(screen.getByLabelText("Assignment reference"), "invalid")
    await user.type(screen.getByLabelText("Access code"), "invalid")
    await user.click(screen.getByRole("button", { name: "Check progress" }))

    expect(await screen.findByText(/could not verify those details/i)).toBeVisible()
    expect(getStatusMock).not.toHaveBeenCalled()
  })

  it("disables submission while the status request is loading", async () => {
    let resolveRequest!: (value: typeof assignment) => void
    getStatusMock.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    const { user } = renderWithRouter(<AssignmentTracking />)
    await enterValidDetails(user)

    await user.click(screen.getByRole("button", { name: "Check progress" }))

    expect(screen.getByRole("button", { name: "Checking" })).toBeDisabled()
    expect(screen.getByText(/checking your assignment/i)).toBeVisible()
    resolveRequest(assignment)
    await screen.findByText(`Reference ${validReference}`)
  })

  it("renders not-found and successful states and focuses successful results", async () => {
    getStatusMock
      .mockRejectedValueOnce(new PublicAssignmentStatusError("not-found"))
      .mockResolvedValueOnce(assignment)
    const { user } = renderWithRouter(<AssignmentTracking />)
    await enterValidDetails(user)
    await user.click(screen.getByRole("button", { name: "Check progress" }))
    expect(await screen.findByText(/could not verify those details/i)).toBeVisible()

    await user.clear(screen.getByLabelText("Assignment reference"))
    await user.clear(screen.getByLabelText("Access code"))
    await enterValidDetails(user)
    await user.click(screen.getByRole("button", { name: "Check progress" }))

    const heading = await screen.findByRole("heading", { name: "Dissertation" })
    expect(screen.getByText(`Reference ${validReference}`)).toBeVisible()
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it("renders rate-limit guidance and retries a temporary error with the last validated input", async () => {
    getStatusMock
      .mockRejectedValueOnce(new PublicAssignmentStatusError("rate-limited"))
      .mockRejectedValueOnce(new PublicAssignmentStatusError("unavailable"))
      .mockResolvedValueOnce(assignment)
    const { user } = renderWithRouter(<AssignmentTracking />)
    await enterValidDetails(user)
    await user.click(screen.getByRole("button", { name: "Check progress" }))
    expect(await screen.findByRole("heading", { name: "Too many requests" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Check progress" }))
    expect(await screen.findByRole("heading", { name: "Tracking is temporarily unavailable" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText(`Reference ${validReference}`)).toBeVisible()
    expect(screen.getByLabelText("Access code")).toHaveValue("")
  })
})
