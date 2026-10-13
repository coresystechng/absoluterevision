import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderWithRouter } from "@/test/render"
import { Pricing } from "./Pricing"

describe("public pricing", () => {
  it("shows every approved service, VAT and transfer-fee exclusions, and custom quote action", () => {
    renderWithRouter(<Pricing />)
    for (const name of ["Assignments & essays", "BSc. dissertation", "MSc. dissertation", "Custom projects & papers"]) {
      expect(screen.getByRole("heading", { name })).toBeVisible()
    }
    for (const price of ["$40", "$113", "$150"]) expect(screen.getByText(price, { exact: false })).toBeVisible()
    expect(screen.getByText(/All prices exclude VAT and transfer fees/)).toBeVisible()
    expect(screen.getByRole("link", { name: "Request a quote" })).toHaveAttribute("href", "mailto:coresystechng@gmail.com?subject=Journal%20or%20magazine%20editing%20quote")
    expect(screen.getByRole("link", { name: "+234 9024 364876" })).toHaveAttribute("href", "https://wa.me/2349024364876")
  })
})
