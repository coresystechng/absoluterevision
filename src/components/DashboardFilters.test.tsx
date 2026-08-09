import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardFilters } from "@/components/DashboardFilters"
import { defaultDashboardFilters } from "@/lib/dashboard-preferences"

function setMobile(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
}

function renderFilters(overrides: Partial<React.ComponentProps<typeof DashboardFilters>> = {}) {
  const props: React.ComponentProps<typeof DashboardFilters> = {
    filters: defaultDashboardFilters,
    onFilters: vi.fn(),
    query: "",
    onQuery: vi.fn(),
    sortField: "deadline",
    onSortField: vi.fn(),
    sortDirection: "desc",
    onSortDirection: vi.fn(),
    ...overrides,
  }

  return { ...render(<DashboardFilters {...props} />), props }
}

describe("DashboardFilters", () => {
  beforeEach(() => setMobile(false))

  it("labels search and renders one desktop filter body", () => {
    renderFilters()
    expect(screen.getByRole("textbox", { name: /search assignments by/i })).toHaveAttribute(
      "placeholder",
      "Search assignments",
    )
    expect(screen.getAllByRole("combobox")).toHaveLength(5)
  })

  it("stages mobile changes and applies filters and sort explicitly", async () => {
    setMobile(true)
    const user = userEvent.setup()
    const { props } = renderFilters()

    await user.click(screen.getByRole("button", { name: "Filters" }))
    screen.getByRole("combobox", { name: "Filter by priority" }).focus()
    await user.keyboard("{Enter}{ArrowDown}{Enter}")
    screen.getByRole("combobox", { name: "Sort assignments by" }).focus()
    await user.keyboard("{Enter}{ArrowDown}{Enter}")

    expect(props.onFilters).not.toHaveBeenCalled()
    expect(props.onSortField).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(props.onFilters).toHaveBeenCalledWith({ ...defaultDashboardFilters, priority: "high" })
    expect(props.onSortField).toHaveBeenCalledWith("name")
    expect(props.onSortDirection).toHaveBeenCalledWith("desc")
  })

  it("discards staged changes on Escape and restores trigger focus", async () => {
    setMobile(true)
    const user = userEvent.setup()
    const { props } = renderFilters({
      filters: { ...defaultDashboardFilters, status: "ongoing" },
    })
    const trigger = screen.getByRole("button", { name: "Filters" })

    await user.click(trigger)
    await user.click(screen.getByRole("button", { name: "Clear" }))
    await user.keyboard("{Escape}")

    expect(props.onFilters).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })

  it("clears the staged mobile form only when Apply is selected", async () => {
    setMobile(true)
    const user = userEvent.setup()
    const { props } = renderFilters({
      filters: { ...defaultDashboardFilters, type: "Dissertation", priority: "high" },
    })

    await user.click(screen.getByRole("button", { name: "Filters" }))
    await user.click(screen.getByRole("button", { name: "Clear" }))
    expect(props.onFilters).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(props.onFilters).toHaveBeenCalledWith(defaultDashboardFilters)
  })

  it("removes active chips individually and clears them all", async () => {
    const user = userEvent.setup()
    const { props } = renderFilters({
      filters: { ...defaultDashboardFilters, priority: "high", status: "ongoing" },
    })

    await user.click(screen.getByRole("button", { name: "Remove high filter" }))
    expect(props.onFilters).toHaveBeenCalledWith({
      ...defaultDashboardFilters,
      priority: "all",
      status: "ongoing",
    })

    await user.click(screen.getByRole("button", { name: "Clear all" }))
    expect(props.onFilters).toHaveBeenLastCalledWith(defaultDashboardFilters)
  })
})
