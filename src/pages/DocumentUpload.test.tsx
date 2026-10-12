import { fireEvent, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { submitDocumentUploads } from "@/api/document-upload"
import { DocumentUpload } from "./DocumentUpload"
import { renderWithRouter } from "@/test/render"

vi.mock("@/api/document-upload", () => ({ submitDocumentUploads: vi.fn() }))
const submitMock = vi.mocked(submitDocumentUploads)
const makeFile = (name: string) => new File(["content"], name)
const makeResult = (file: File) => ({ fileName: file.name, sizeBytes: file.size, submittedAt: "2026-10-12T10:00:00Z" })

async function fillContactDetails(user: ReturnType<typeof renderWithRouter>["user"]) {
  await user.type(screen.getByLabelText("Full Name"), "Test Client")
  await user.type(screen.getByLabelText("Email Address"), "client@example.com")
}

describe("client submission form", () => {
  beforeEach(() => submitMock.mockReset())

  it("rejects a selection over three files and lets clients remove a selected file", async () => {
    const { user } = renderWithRouter(<DocumentUpload />)
    const input = screen.getByLabelText("Documents or images")
    expect(input).toHaveAttribute("multiple")
    fireEvent.change(input, { target: { files: Array.from({ length: 4 }, () => makeFile("draft.pdf")) } })
    expect(screen.getByRole("alert")).toHaveTextContent("Choose up to 3 files")
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled()
    await user.upload(input, [makeFile("draft.pdf"), makeFile("photo.png")])
    await user.click(screen.getByRole("button", { name: "Remove photo.png" }))
    expect(within(screen.getByRole("list", { name: "Selected files" })).getAllByRole("listitem")).toHaveLength(1)
    expect(submitMock).not.toHaveBeenCalled()
  })

  it("submits three documents and images and shows each file in the confirmation", async () => {
    const files = [makeFile("draft.pdf"), makeFile("photo.png"), makeFile("figure.jpg")]
    submitMock.mockResolvedValue({ uploads: files.map(makeResult), failures: [] })
    const { user } = renderWithRouter(<DocumentUpload />)
    await fillContactDetails(user)
    await user.upload(screen.getByLabelText("Documents or images"), files)
    await user.click(screen.getByRole("button", { name: "Submit" }))
    const dialog = await screen.findByRole("dialog")
    for (const file of files) expect(within(dialog).getByText(new RegExp(file.name))).toBeVisible()
    expect(submitMock.mock.calls[0][0].files).toEqual(files)
  })

  it("retries only failed files after a partial upload", async () => {
    const files = [makeFile("draft.pdf"), makeFile("photo.png")]
    submitMock
      .mockResolvedValueOnce({ uploads: [makeResult(files[0])], failures: [{ file: files[1], message: "Connection lost" }] })
      .mockResolvedValueOnce({ uploads: [makeResult(files[1])], failures: [] })
    const { user } = renderWithRouter(<DocumentUpload />)
    await fillContactDetails(user)
    await user.upload(screen.getByLabelText("Documents or images"), files)
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("photo.png: Connection lost")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Submit" }))
    const dialog = await screen.findByRole("dialog")
    expect(submitMock.mock.calls[1][0].files).toEqual([files[1]])
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2)
  })
})
