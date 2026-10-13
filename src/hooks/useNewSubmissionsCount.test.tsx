import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { getNewClientSubmissionsCount } from "@/api/client-submissions"
import { useNewSubmissionsCount } from "./useNewSubmissionsCount"

vi.mock("@/api/client-submissions", () => ({ getNewClientSubmissionsCount: vi.fn() }))

describe("new submission count", () => {
  it("does not request inbox data without access", () => {
    vi.mocked(getNewClientSubmissionsCount).mockClear()
    const { result } = renderHook(() => useNewSubmissionsCount("member", false))
    expect(result.current).toBeNull()
    expect(getNewClientSubmissionsCount).not.toHaveBeenCalled()
  })

  it("refreshes on return, clears failed counts, and removes listeners on unmount", async () => {
    const request = vi.mocked(getNewClientSubmissionsCount)
    request.mockReset().mockResolvedValueOnce({ count: 27 }).mockResolvedValueOnce({ count: 26 }).mockRejectedValueOnce(new Error("offline"))
    const { result, unmount } = renderHook(() => useNewSubmissionsCount("admin", true))
    await waitFor(() => expect(result.current).toBe(27))
    act(() => window.dispatchEvent(new Event("focus")))
    await waitFor(() => expect(result.current).toBe(26))
    act(() => window.dispatchEvent(new Event("focus")))
    await waitFor(() => expect(result.current).toBeNull())
    unmount()
    window.dispatchEvent(new Event("focus"))
    expect(request).toHaveBeenCalledTimes(3)
  })
})
