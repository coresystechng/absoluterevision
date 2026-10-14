import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import * as api from "@/api/assignments"
import { acquireWorkspace, disposeWorkspace, workspaceKeys } from "@/lib/workspace-cache"
import { useAssignments } from "./useAssignments"
import type { Assignment } from "@/types"
vi.mock("@/api/users", () => ({ getOrCreateUser: vi.fn() }))
vi.mock("@/api/assignments", () => ({ getAll: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), getById: vi.fn() }))
afterEach(() => { disposeWorkspace(); vi.clearAllMocks() })
const row: Assignment = { id: 1, trackingCode: "AR-test", userId: "A", teamId: 1, teamName: "Team", currentUserRole: "admin", assigneeUserId: "A", assigneeName: "A", assigneeEmail: "a@example.com", title: "Original", category: "Assignment", priority: "high", status: "ongoing", progressStage: "ai-draft", dueDate: null, dueTime: null, progress: 0, notes: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }
function wrapper() {
  const { client } = acquireWorkspace("A")
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
it("does not read a null team and reuses an empty confirmed list across remounts", async () => {
  vi.mocked(api.getAll).mockResolvedValue([])
  const wrap = wrapper()
  const pending = renderHook(() => useAssignments("A", null, null), { wrapper: wrap })
  expect(api.getAll).not.toHaveBeenCalled()
  pending.unmount()
  const first = renderHook(() => useAssignments("A", null, 1), { wrapper: wrap })
  await waitFor(() => expect(first.result.current.isLoading).toBe(false))
  first.unmount()
  const second = renderHook(() => useAssignments("A", null, 1), { wrapper: wrap })
  expect(second.result.current.assignments).toEqual([])
  expect(api.getAll).toHaveBeenCalledTimes(1)
  let resolve!: (value: []) => void
  vi.mocked(api.getAll).mockReturnValue(new Promise((done) => { resolve = done }))
  act(() => { void second.result.current.reload() })
  await waitFor(() => expect(second.result.current.isRefreshing).toBe(true))
  expect(second.result.current.isLoading).toBe(false)
  await act(async () => resolve([]))
})
it("never exposes A's late rows under B's selected team", async () => {
  let resolve!: (value: Assignment[]) => void
  vi.mocked(api.getAll).mockReturnValueOnce(new Promise((done) => { resolve = done })).mockResolvedValueOnce([{ ...row, teamId: 2, title: "Team B" }])
  const { result, rerender } = renderHook(({ team }) => useAssignments("A", null, team), { wrapper: wrapper(), initialProps: { team: 1 } })
  rerender({ team: 2 })
  await waitFor(() => expect(result.current.assignments[0]?.title).toBe("Team B"))
  await act(async () => resolve([row]))
  expect(api.getAll).toHaveBeenNthCalledWith(2, "A", 2)
  expect(result.current.assignments.map((value) => value.title)).toEqual(["Team B"])
})
it("acknowledges update without a list reload and suppresses an older pending read", async () => {
  vi.mocked(api.getAll).mockResolvedValueOnce([row])
  const wrap = wrapper()
  const { result } = renderHook(() => useAssignments("A", null, 1), { wrapper: wrap })
  await waitFor(() => expect(result.current.assignments).toEqual([row]))
  let resolve!: (value: Assignment[]) => void
  vi.mocked(api.getAll).mockReturnValueOnce(new Promise((done) => { resolve = done }))
  act(() => { void result.current.reload() })
  const edited = { ...row, title: "Edited" }
  vi.mocked(api.update).mockResolvedValue(edited)
  await act(async () => { expect(await result.current.update(1, { title: "Edited" })).toEqual(edited) })
  expect(acquireWorkspace("A").client.getQueryData(workspaceKeys.assignments("A", 1))).toEqual([edited])
  await waitFor(() => expect(result.current.assignments).toEqual([edited]))
  expect(api.getAll).toHaveBeenCalledTimes(2)
  await act(async () => resolve([row]))
  expect(acquireWorkspace("A").client.getQueryData(workspaceKeys.assignments("A", 1))).toEqual([edited])
  await waitFor(() => expect(result.current.assignments).toEqual([edited]))
  expect(acquireWorkspace("A").client.getQueryData(workspaceKeys.assignment("A", 1))).toEqual(edited)
})
it("rejects null or failed writes without changing confirmed data", async () => {
  vi.mocked(api.getAll).mockResolvedValue([row])
  const { result } = renderHook(() => useAssignments("A", null, 1), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.assignments).toEqual([row]))
  vi.mocked(api.update).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Denied"))
  await expect(result.current.update(1, { title: "Edited" })).rejects.toThrow()
  await expect(result.current.update(1, { title: "Edited" })).rejects.toThrow()
  expect(result.current.assignments).toEqual([row])
})
it("retains a still-accessible row after a no-op deletion and removes only after confirmation", async () => {
  vi.mocked(api.getAll).mockResolvedValue([row])
  vi.mocked(api.remove).mockResolvedValue(undefined)
  vi.mocked(api.getById).mockResolvedValueOnce(row).mockResolvedValueOnce(null)
  const { result } = renderHook(() => useAssignments("A", null, 1), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.assignments).toEqual([row]))
  await act(async () => { await expect(result.current.remove(1)).rejects.toThrow("Removal could not be confirmed") })
  expect(result.current.assignments).toEqual([row])
  await act(async () => { await result.current.remove(1) })
  expect(acquireWorkspace("A").client.getQueryData(workspaceKeys.assignments("A", 1))).toEqual([])
  await waitFor(() => expect(result.current.assignments).toEqual([]))
  expect(api.getAll).toHaveBeenCalledTimes(1)
  expect(api.getById).toHaveBeenCalledTimes(2)
})
it("moves returned entities only into loaded lists and preserves unrelated freshness", async () => {
  const wrap = wrapper()
  const { client } = acquireWorkspace("A")
  client.setQueryData(workspaceKeys.assignments("A", 1), [row])
  client.setQueryData(workspaceKeys.assignments("A", 2), [])
  client.setQueryData(workspaceKeys.assignments("A", 3), [])
  vi.mocked(api.update).mockResolvedValue({ ...row, teamId: 2 })
  const { result } = renderHook(() => useAssignments("A", null, 1), { wrapper: wrap })
  await act(async () => { await result.current.update(1, { title: "Original", teamId: 2 }) })
  expect(client.getQueryData(workspaceKeys.assignments("A", 1))).toEqual([])
  expect(client.getQueryData(workspaceKeys.assignments("A", 2))).toEqual([{ ...row, teamId: 2 }])
  expect(client.getQueryState(workspaceKeys.assignments("A", 3))?.isInvalidated).toBe(false)
  expect(client.getQueryData(workspaceKeys.assignments("A", 4))).toBeUndefined()
})
