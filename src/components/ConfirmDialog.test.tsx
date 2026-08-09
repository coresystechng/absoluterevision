import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { renderWithRouter } from "@/test/render"

function deferred() { let resolve!: () => void; let reject!: () => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

describe("ConfirmDialog async contract", () => {
  it("stays open, disables actions, and prevents duplicates while pending", async () => {
    const work = deferred(); const confirm = vi.fn(() => work.promise)
    const { user } = renderWithRouter(<ConfirmDialog title="Delete item?" description="Permanent" onConfirm={confirm}><Button>Open</Button></ConfirmDialog>)
    await user.click(screen.getByRole("button", { name: "Open" })); await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled(); expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Deleting..." })); expect(confirm).toHaveBeenCalledOnce()
    work.resolve(); await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("closes after success and remains recoverable after rejection", async () => {
    const confirm = vi.fn().mockRejectedValueOnce(new Error("private")).mockResolvedValueOnce(undefined)
    const { user } = renderWithRouter(<ConfirmDialog title="Delete item?" description="Permanent" onConfirm={confirm}><Button>Open</Button></ConfirmDialog>)
    await user.click(screen.getByRole("button", { name: "Open" })); await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be completed/i); expect(screen.queryByText("private")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete" })); expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
