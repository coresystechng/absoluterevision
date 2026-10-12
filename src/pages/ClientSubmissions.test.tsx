import { screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ClientSubmissionsError, convertClientSubmission, getClientSubmissionDownloadUrl, getClientSubmissions } from "@/api/client-submissions"
import { ClientSubmissions } from "./ClientSubmissions"
import { renderWithRouter } from "@/test/render"
import type { ClientSubmissionsPage } from "../../shared/client-submissions"

vi.mock("@/api/client-submissions", async (importOriginal) => ({ ...await importOriginal<typeof import("@/api/client-submissions")>(), getClientSubmissions: vi.fn(), getClientSubmissionDownloadUrl: vi.fn(), convertClientSubmission: vi.fn() }))
vi.mock("@/components/Navbar", () => ({ Navbar: () => <nav>Navigation</nav> }))
const userProfile = { id: "admin", email: "admin@example.com", displayName: "Admin" }
const page: ClientSubmissionsPage = {
  submissions: [{ id: "b0d8c443-e1bc-49f1-8e68-f0f19c02a862", fullName: "Test Client", email: "client@example.com", submittedAt: "2026-10-12T10:00:00Z", convertedAt: null, assignmentId: null, teamId: null, files: [{ index: 0, name: "draft.pdf", mimeType: "application/pdf", sizeBytes: 100, status: "ready" }, { index: 1, name: "figure.png", mimeType: "image/png", sizeBytes: 200, status: "ready" }] }],
  teams: [{ id: 1, name: "Editorial", members: [{ userId: "admin", email: "admin@example.com", displayName: "Admin" }, { userId: "editor", email: "editor@example.com", displayName: "Editor" }] }],
  nextCursor: null,
}
const renderPage = () => renderWithRouter(<ClientSubmissions user={userProfile} onSignOut={() => undefined} />)

beforeEach(() => {
  vi.mocked(getClientSubmissions).mockReset().mockResolvedValue(page)
  vi.mocked(convertClientSubmission).mockReset()
  vi.mocked(getClientSubmissionDownloadUrl).mockReset()
  vi.spyOn(window, "open").mockReturnValue(null)
})

describe("client submissions inbox", () => {
  it("renders grouped files, contact details, and a usable download link when popups are blocked", async () => {
    vi.mocked(getClientSubmissionDownloadUrl).mockResolvedValue({ url: "https://example.com/download" })
    const { user } = renderPage()
    expect(await screen.findByRole("heading", { name: "Test Client" })).toBeVisible()
    expect(screen.getByRole("link", { name: "client@example.com" })).toHaveAttribute("href", "mailto:client@example.com")
    expect(within(screen.getByRole("list", { name: "Files from Test Client" })).getAllByRole("listitem")).toHaveLength(2)
    await user.click(screen.getByRole("button", { name: "Download figure.png" }))
    expect(await screen.findByRole("link", { name: "Open file" })).toHaveAttribute("href", "https://example.com/download")
    expect(getClientSubmissionDownloadUrl).toHaveBeenCalledWith(page.submissions[0].id, 1)
  })

  it("denies members access and offers a dashboard return", async () => {
    vi.mocked(getClientSubmissions).mockRejectedValue(new ClientSubmissionsError("Only admins can access submissions.", 403))
    renderPage()
    expect(await screen.findByRole("heading", { name: "Admin access required" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Back to dashboard" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Create assignment" })).not.toBeInTheDocument()
  })

  it("creates an assignment with the chosen assignee and keeps the dialog open on failure", async () => {
    vi.mocked(convertClientSubmission).mockRejectedValueOnce(new Error("Uploads are still pending"))
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "Create assignment" }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByLabelText("Assignment title")).toHaveValue("draft")
    await user.selectOptions(within(dialog).getByLabelText("Assignee"), "editor")
    await user.selectOptions(within(dialog).getByLabelText("Assignment type"), "Design")
    await user.click(within(dialog).getByRole("button", { name: "Create assignment" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Uploads are still pending")
    expect(convertClientSubmission).toHaveBeenCalledWith(expect.objectContaining({ submissionId: page.submissions[0].id, teamId: 1, assigneeUserId: "editor", category: "Design", title: "draft" }))
  })

  it("prevents conversion during incomplete uploads and offers the existing assignment after conversion", async () => {
    vi.mocked(getClientSubmissions).mockResolvedValue({ ...page, submissions: [{ ...page.submissions[0], files: [{ ...page.submissions[0].files[0], status: "pending" }] }] })
    const { user } = renderPage()
    expect(await screen.findByRole("button", { name: "Create assignment" })).toBeDisabled()
    vi.mocked(getClientSubmissions).mockResolvedValue({ ...page, submissions: [{ ...page.submissions[0], convertedAt: "2026-10-12T11:00:00Z", assignmentId: 42 }] })
    await user.click(screen.getByRole("button", { name: "Refresh" }))
    expect(await screen.findByRole("link", { name: "Open assignment" })).toHaveAttribute("href", "/assignments/42")
    expect(screen.queryByRole("button", { name: "Create assignment" })).not.toBeInTheDocument()
  })

  it("searches on submit and loads the next page", async () => {
    const { user } = renderPage()
    await screen.findByText("draft.pdf")
    await user.type(screen.getByRole("textbox", { name: "Search client submissions" }), "Client")
    vi.mocked(getClientSubmissions).mockResolvedValue({ ...page, nextCursor: "next-page" })
    await user.click(screen.getByRole("button", { name: "Search" }))
    await user.click(await screen.findByRole("button", { name: "Load more submissions" }))
    expect(getClientSubmissions).toHaveBeenLastCalledWith({ search: "Client", status: "new", cursor: "next-page" })
  })
})
