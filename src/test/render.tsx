import { ThemeProvider } from "@/hooks/useTheme"
import type { ReactElement } from "react"
import { render, type RenderOptions } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { WorkspaceProvider } from "@/components/WorkspaceProvider"
import { disposeWorkspace } from "@/lib/workspace-cache"
import type { AuthUser } from "@/types"

type RenderWithRouterOptions = Omit<RenderOptions, "wrapper"> & {
  initialEntries?: string[]
  workspaceUser?: AuthUser
}

export function renderWithRouter(
  ui: ReactElement,
  { initialEntries = ["/"], workspaceUser, ...renderOptions }: RenderWithRouterOptions = {},
) {
  const user = userEvent.setup()
  if (workspaceUser) disposeWorkspace()
  const result = render(
    <MemoryRouter initialEntries={initialEntries}><ThemeProvider>{workspaceUser ? <WorkspaceProvider user={workspaceUser}>{ui}</WorkspaceProvider> : ui}</ThemeProvider></MemoryRouter>,
    renderOptions,
  )

  return { user, ...result }
}
