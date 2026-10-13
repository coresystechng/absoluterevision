import { ThemeProvider } from "@/hooks/useTheme"
import type { ReactElement } from "react"
import { render, type RenderOptions } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

type RenderWithRouterOptions = Omit<RenderOptions, "wrapper"> & {
  initialEntries?: string[]
}

export function renderWithRouter(
  ui: ReactElement,
  { initialEntries = ["/"], ...renderOptions }: RenderWithRouterOptions = {},
) {
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={initialEntries}><ThemeProvider>{ui}</ThemeProvider></MemoryRouter>,
    renderOptions,
  )

  return { user, ...result }
}
