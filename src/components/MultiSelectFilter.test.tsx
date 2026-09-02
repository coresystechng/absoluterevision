import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { MultiSelectFilter } from "@/components/MultiSelectFilter"

const options = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const

function MultiSelectFilterHarness() {
  const [value, setValue] = useState<Array<(typeof options)[number]["value"]>>([])

  return (
    <>
      <MultiSelectFilter
        value={value}
        options={[...options]}
        allLabel="All Priorities"
        pluralLabel="priorities"
        ariaLabel="Filter by priority"
        onValueChange={setValue}
      />
      <output aria-label="Selected priorities">{value.join(",") || "all"}</output>
    </>
  )
}

describe("MultiSelectFilter", () => {
  it("keeps the menu open for stacked choices and collapses every choice to All", async () => {
    const user = userEvent.setup()
    render(<MultiSelectFilterHarness />)

    await user.click(screen.getByRole("button", { name: "Filter by priority: All Priorities" }))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "High" }))
    expect(screen.getByLabelText("Selected priorities")).toHaveTextContent("high")

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Medium" }))
    expect(screen.getByLabelText("Selected priorities")).toHaveTextContent("high,medium")
    expect(screen.getByRole("menu", { name: "Filter by priority: 2 priorities" })).toBeVisible()

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Low" }))
    expect(screen.getByLabelText("Selected priorities")).toHaveTextContent("all")
    expect(screen.getByRole("menuitemcheckbox", { name: "All Priorities" })).toBeChecked()
  })
})
