import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DetailPageLayout } from "@/components/DetailPageLayout"

describe("DetailPageLayout", () => {
  it("renders named slots in stable landmark order with responsive minmax geometry", () => {
    render(<DetailPageLayout header={<h1>Header</h1>} primary={<p>Primary</p>} rail={<p>Rail</p>} />)
    expect(screen.getByRole("main")).toHaveClass("max-w-6xl")
    expect(screen.getByRole("region", { name: "Assignment workspace" }).parentElement).toHaveClass("lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]")
    expect(screen.getByRole("complementary", { name: "Assignment context" })).toHaveClass("lg:sticky", "lg:top-20")
    expect(screen.getByText("Primary").compareDocumentPosition(screen.getByText("Rail")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
