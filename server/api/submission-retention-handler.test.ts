import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ cleanupExpiredSubmissions: vi.fn() }))
vi.mock("./submission-retention.js", () => mocks)
import handler from "../../api/cron/submission-retention.js"

const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() })
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-cron-secret")
  mocks.cleanupExpiredSubmissions.mockReset().mockResolvedValue({ deleted: 2, failed: 0 })
})

describe("protected retention job", () => {
  it("rejects missing and invalid credentials before deleting storage", async () => {
    for (const authorization of [undefined, "Bearer invalid", "Bearer test-cron-secret-extra"]) {
      const res = response()
      await handler({ method: "GET", headers: { authorization } } as never, res as never)
      expect(res.status).toHaveBeenCalledWith(401)
    }
    expect(mocks.cleanupExpiredSubmissions).not.toHaveBeenCalled()
  })
  it("runs with a valid secret and surfaces deletion failures for monitoring", async () => {
    for (const failed of [0, 1]) {
      mocks.cleanupExpiredSubmissions.mockResolvedValue({ deleted: 2, failed })
      const res = response()
      await handler({ method: "GET", headers: { authorization: "Bearer test-cron-secret" } } as never, res as never)
      expect(res.status).toHaveBeenCalledWith(failed ? 503 : 200)
    }
  })
})
