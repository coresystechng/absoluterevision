import { beforeEach, describe, expect, it, vi } from "vitest"

const handlers = vi.hoisted(() => ({ start: vi.fn(), append: vi.fn(), finish: vi.fn() }))
vi.mock("./assignment-file-upload-session-start.js", () => ({ default: handlers.start }))
vi.mock("./assignment-file-upload-session-append.js", () => ({ default: handlers.append }))
vi.mock("./assignment-file-upload-session-finish.js", () => ({ default: handlers.finish }))
import handler from "../../api/assignment-files/upload-session/[action].js"

beforeEach(() => vi.resetAllMocks())

describe("shared assignment upload session function", () => {
  it.each(["start", "append", "finish"] as const)("preserves the %s endpoint and request metadata", async (action) => {
    const req = { method: "POST", query: { action, sessionId: "session", offset: "100" }, headers: { authorization: "Bearer token" }, body: Buffer.from("chunk") }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    await handler(req as never, res as never)
    expect(handlers[action]).toHaveBeenCalledWith(req, res)
    expect(Object.values(handlers).filter((mock) => mock.mock.calls.length > 0)).toHaveLength(1)
  })

  it("rejects unknown actions without starting a Dropbox operation", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    await handler({ headers: {}, query: { action: "unknown" } } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(404)
    Object.values(handlers).forEach((mock) => expect(mock).not.toHaveBeenCalled())
  })
})
