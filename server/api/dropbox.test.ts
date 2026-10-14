import { createCipheriv } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { OwnerConnectionRow } from "./db.js"

const db = vi.hoisted(() => ({ getOwnerConnection: vi.fn(), saveOwnerConnection: vi.fn(), getAssignmentFolder: vi.fn(), saveAssignmentFolder: vi.fn() }))
vi.mock("./db.js", () => db)
const key = Buffer.alloc(32, 7)
function connection(label = "a"): OwnerConnectionRow {
  const iv = Buffer.alloc(12, label.charCodeAt(0))
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(`synthetic-refresh-${label}`), cipher.final()])
  return { owner_user_id: "synthetic-owner", refresh_token_ciphertext: encrypted.toString("base64"), refresh_token_iv: iv.toString("base64"), refresh_token_tag: cipher.getAuthTag().toString("base64"), scopes: "files.content.write files.content.read" }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }) }
const fetchMock = vi.fn()
async function load() { return import("./dropbox.js") }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve() }

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  vi.stubEnv("DROPBOX_CLIENT_ID", "synthetic-client")
  vi.stubEnv("DROPBOX_CLIENT_SECRET", "synthetic-secret")
  vi.stubEnv("DROPBOX_TOKEN_ENCRYPTION_KEY", key.toString("base64"))
  vi.stubGlobal("fetch", fetchMock)
  db.getOwnerConnection.mockResolvedValue(connection())
  fetchMock.mockImplementation(async () => json({ access_token: "token-a", expires_in: 3600 }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("owner access-token reuse", () => {
  it("reuses sequential warm tokens while retaining the connection lookup and refreshes at the margin", async () => {
    const api = await load()
    expect(await api.getOwnerAccessToken()).toBe("token-a")
    expect(await api.getOwnerAccessToken()).toBe("token-a")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(db.getOwnerConnection).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(3540000)
    await api.getOwnerAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("shares one refresh across ten initial concurrent lookups", async () => {
    const api = await load()
    const response = deferred<Response>()
    fetchMock.mockReturnValue(response.promise)
    const results = Promise.all(Array.from({ length: 10 }, () => api.getOwnerAccessToken()))
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    response.resolve(json({ access_token: "shared", expires_in: 3600 }))
    expect(await results).toEqual(Array(10).fill("shared"))
  })
  it.each([undefined, null, 0, -1, "3600", Infinity, NaN, Number.MAX_VALUE])("does not reuse invalid or missing expiry %s", async (expires_in) => {
    const api = await load()
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ access_token: "uncached", expires_in }) }))
    expect(await api.getOwnerAccessToken()).toBe("uncached")
    expect(await api.getOwnerAccessToken()).toBe("uncached")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("shares short-lived tokens with current callers but never subsequent lookups", async () => {
    const api = await load()
    fetchMock.mockImplementation(async () => json({ access_token: "short", expires_in: 60 }))
    expect(await Promise.all([api.getOwnerAccessToken(), api.getOwnerAccessToken()])).toEqual(["short", "short"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await api.getOwnerAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("calculates expiry from request start and rejects time elapsed during JSON processing", async () => {
    const api = await load()
    fetchMock.mockImplementation(async () => {
      vi.advanceTimersByTime(1000)
      return { ok: true, json: async () => { vi.advanceTimersByTime(1000); return { access_token: "expired-private", expires_in: 2 } } }
    })
    await expect(api.getOwnerAccessToken()).rejects.toMatchObject({ statusCode: 502, message: "Dropbox returned an expired access token." })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("clears cached state on disconnect", async () => {
    const api = await load()
    await api.getOwnerAccessToken()
    db.getOwnerConnection.mockResolvedValueOnce(null)
    await expect(api.getOwnerAccessToken()).rejects.toMatchObject({ statusCode: 409 })
    await api.getOwnerAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("clears rejected refresh state for a later recovery", async () => {
    const api = await load()
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, 400))
    await expect(api.getOwnerAccessToken()).rejects.toMatchObject({ statusCode: 400 })
    expect(await api.getOwnerAccessToken()).toBe("token-a")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it.each(["old", "null"])("discards delayed initial %s database reads after B is first observed", async (kind) => {
    const api = await load()
    const row = deferred<OwnerConnectionRow | null>()
    db.getOwnerConnection.mockReturnValueOnce(row.promise).mockResolvedValue(connection("b"))
    const old = api.getOwnerAccessToken()
    expect(await api.getOwnerAccessToken()).toBe("token-a")
    row.resolve(kind === "null" ? null : connection("a"))
    expect(await old).toBe("token-a")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(db.getOwnerConnection).toHaveBeenCalledTimes(3)
    expect((fetchMock.mock.calls[0][1].body as URLSearchParams).get("refresh_token")).toBe("synthetic-refresh-b")
  })
  it.each([false, true])("recovers stale OAuth completion (reject=%s) without publishing A", async (reject) => {
    const api = await load()
    const response = deferred<Response>()
    fetchMock.mockReturnValueOnce(response.promise).mockResolvedValue(json({ access_token: "token-b", expires_in: 3600 }))
    const old = api.getOwnerAccessToken()
    await settle()
    db.getOwnerConnection.mockResolvedValue(connection("b"))
    expect(await api.getOwnerAccessToken()).toBe("token-b")
    if (reject) response.reject(new Error("old provider failure"))
    else response.resolve(json({ access_token: "token-old", expires_in: 3600 }))
    expect(await old).toBe("token-b")
    expect(await api.getOwnerAccessToken()).toBe("token-b")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("fails after the single shared recovery budget is consumed", async () => {
    const api = await load()
    const oldRead = deferred<OwnerConnectionRow>()
    const recoveryRead = deferred<OwnerConnectionRow>()
    db.getOwnerConnection.mockReturnValueOnce(oldRead.promise).mockResolvedValue(connection("b"))
    const old = api.getOwnerAccessToken()
    const assertion = expect(old).rejects.toMatchObject({ statusCode: 502, message: "Dropbox connection changed. Please retry the operation." })
    await api.getOwnerAccessToken()
    db.getOwnerConnection.mockReturnValueOnce(recoveryRead.promise)
    oldRead.resolve(connection("a"))
    await settle()
    db.getOwnerConnection.mockResolvedValue(connection("c"))
    await api.getOwnerAccessToken()
    recoveryRead.resolve(connection("b"))
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

const resourceOperations = [
  ["JSON read", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.getDropboxTemporaryLink(token, "synthetic-file")],
  ["JSON delete", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.deleteDropboxFile(token, "synthetic-file")],
  ["folder", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.getOrCreateDocumentUploadFolder({ accessToken: token, uploadId: "synthetic-upload", fullName: "Test", email: "test@example.invalid", submittedAt: "2026-01-01" })],
  ["upload", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.uploadDropboxFile({ accessToken: token, folderPath: "/synthetic", fileName: "test.txt", fileBytes: Buffer.from("test") })],
  ["start", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.startDropboxUploadSession(token, Buffer.from("test"))],
  ["append", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.appendDropboxUploadSession({ accessToken: token, sessionId: "synthetic-session", offset: 3, fileBytes: Buffer.from("test") })],
  ["finish", async (api: Awaited<ReturnType<typeof load>>, token: string) => api.finishDropboxUploadSession({ accessToken: token, sessionId: "synthetic-session", offset: 3, folderPath: "/synthetic", fileName: "test.txt", fileBytes: Buffer.from("test") })],
] as const

describe("resource failures and reconnection", () => {
  it.each(resourceOperations)("invalidates matching token on %s 401 without replay", async (_name, operation) => {
    const api = await load()
    const token = await api.getOwnerAccessToken()
    fetchMock.mockResolvedValueOnce(json({ error_summary: "auth/rejected" }, 401))
    await expect(operation(api, token)).rejects.toMatchObject({ statusCode: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    fetchMock.mockResolvedValueOnce(json({ access_token: "recovered", expires_in: 3600 }))
    expect(await api.getOwnerAccessToken()).toBe("recovered")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it.each([403, 409, 429])("preserves cache and provider error %s without replay", async (status) => {
    const api = await load()
    const token = await api.getOwnerAccessToken()
    fetchMock.mockResolvedValueOnce(json({ error_summary: "synthetic/error" }, status))
    await expect(api.appendDropboxUploadSession({ accessToken: token, sessionId: "synthetic", offset: 3, fileBytes: Buffer.from("test") })).rejects.toMatchObject({ statusCode: status, message: "synthetic/error" })
    expect(await api.getOwnerAccessToken()).toBe(token)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("preserves the folder conflict success behavior and cached token", async () => {
    const api = await load()
    const token = await api.getOwnerAccessToken()
    fetchMock.mockImplementation(async () => json({ error_summary: "path/conflict/folder/..." }, 409))
    await expect(api.getOrCreateDocumentUploadFolder({ accessToken: token, uploadId: "synthetic", fullName: "Test", email: "test@example.invalid", submittedAt: "2026-01-01" })).resolves.toContain("synthetic")
    expect(await api.getOwnerAccessToken()).toBe(token)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
  it("does not let late old-token 401 evict a refreshed token", async () => {
    const api = await load()
    const token = await api.getOwnerAccessToken()
    const response = deferred<Response>()
    fetchMock.mockReturnValueOnce(response.promise)
    const operation = api.deleteDropboxFile(token, "synthetic-file")
    const assertion = expect(operation).rejects.toMatchObject({ statusCode: 401 })
    vi.advanceTimersByTime(3540000)
    fetchMock.mockResolvedValueOnce(json({ access_token: "new-token", expires_in: 3600 }))
    expect(await api.getOwnerAccessToken()).toBe("new-token")
    response.resolve(json({ error: "rejected" }, 401))
    await assertion
    expect(await api.getOwnerAccessToken()).toBe("new-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it("invalidates on successful reconnect without seeding code-response access token", async () => {
    const api = await load()
    await api.getOwnerAccessToken()
    fetchMock.mockResolvedValueOnce(json({ access_token: "code-token", refresh_token: "synthetic-new-refresh", expires_in: 3600 }))
    db.saveOwnerConnection.mockImplementation(async () => { db.getOwnerConnection.mockResolvedValue(connection("b")) })
    await api.exchangeDropboxCode({ code: "synthetic-code", redirectUri: "https://example.invalid/callback", ownerUserId: "synthetic-owner" })
    fetchMock.mockResolvedValueOnce(json({ access_token: "new-token", expires_in: 3600 }))
    expect(await api.getOwnerAccessToken()).toBe("new-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(db.saveOwnerConnection).toHaveBeenCalledTimes(1)
  })
  it("retains persisted cache if reconnect save fails", async () => {
    const api = await load()
    await api.getOwnerAccessToken()
    fetchMock.mockResolvedValueOnce(json({ access_token: "unpersisted", refresh_token: "synthetic-new-refresh" }))
    db.saveOwnerConnection.mockRejectedValueOnce(new Error("synthetic save failure"))
    await expect(api.exchangeDropboxCode({ code: "synthetic", redirectUri: "https://example.invalid", ownerUserId: "synthetic-owner" })).rejects.toThrow("synthetic save failure")
    expect(await api.getOwnerAccessToken()).toBe("token-a")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it.each(["row", "null", "refresh"])("discards in-flight %s after successful local reconnect", async (kind) => {
    const api = await load()
    const row = deferred<OwnerConnectionRow | null>()
    const response = deferred<Response>()
    if (kind === "refresh") fetchMock.mockReturnValueOnce(response.promise)
    else db.getOwnerConnection.mockReturnValueOnce(row.promise)
    const old = api.getOwnerAccessToken()
    await settle()
    fetchMock.mockResolvedValueOnce(json({ refresh_token: "synthetic-new-refresh", access_token: "code-token" }))
    db.saveOwnerConnection.mockImplementation(async () => { db.getOwnerConnection.mockResolvedValue(connection("b")) })
    await api.exchangeDropboxCode({ code: "synthetic", redirectUri: "https://example.invalid", ownerUserId: "synthetic-owner" })
    fetchMock.mockResolvedValueOnce(json({ access_token: "new-token", expires_in: 3600 }))
    if (kind === "refresh") response.resolve(json({ access_token: "old-token", expires_in: 3600 }))
    else row.resolve(kind === "null" ? null : connection("a"))
    expect(await old).toBe("new-token")
    expect(await api.getOwnerAccessToken()).toBe("new-token")
  })
  it("refreshes when OAuth client identity changes", async () => {
    const api = await load()
    await api.getOwnerAccessToken()
    vi.stubEnv("DROPBOX_CLIENT_ID", "synthetic-other-client")
    await api.getOwnerAccessToken()
    vi.stubEnv("DROPBOX_CLIENT_SECRET", "synthetic-other-secret")
    await api.getOwnerAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})


describe("refresh ownership and bounded recovery", () => {
  it("does not let old finally clear the current generation's pending refresh", async () => {
    const api = await load()
    const oldResponse = deferred<Response>()
    const newResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(oldResponse.promise).mockReturnValueOnce(newResponse.promise)
    const old = api.getOwnerAccessToken()
    await settle()
    db.getOwnerConnection.mockResolvedValue(connection("b"))
    const current = api.getOwnerAccessToken()
    await settle()
    oldResponse.resolve(json({ access_token: "old", expires_in: 3600 }))
    await settle()
    const joined = api.getOwnerAccessToken()
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    newResponse.resolve(json({ access_token: "new", expires_in: 3600 }))
    expect(await Promise.all([old, current, joined])).toEqual(["new", "new", "new"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("shares the recovery budget between a stale database row and a stale OAuth response", async () => {
    const api = await load()
    const oldRead = deferred<OwnerConnectionRow>()
    const recoveryResponse = deferred<Response>()
    db.getOwnerConnection.mockReturnValueOnce(oldRead.promise).mockResolvedValue(connection("b"))
    const old = api.getOwnerAccessToken()
    const assertion = expect(old).rejects.toMatchObject({ statusCode: 502, message: "Dropbox connection changed. Please retry the operation." })
    await api.getOwnerAccessToken()
    vi.advanceTimersByTime(3540000)
    fetchMock.mockReturnValueOnce(recoveryResponse.promise)
    oldRead.resolve(connection("a"))
    await settle()
    db.getOwnerConnection.mockResolvedValue(connection("c"))
    fetchMock.mockResolvedValueOnce(json({ access_token: "current", expires_in: 3600 }))
    expect(await api.getOwnerAccessToken()).toBe("current")
    recoveryResponse.resolve(json({ access_token: "stale", expires_in: 3600 }))
    await assertion
    expect(await api.getOwnerAccessToken()).toBe("current")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it("does not cache token lifetime spent waiting for the provider", async () => {
    const api = await load()
    fetchMock.mockImplementation(async () => {
      vi.advanceTimersByTime(31000)
      return json({ access_token: "short", expires_in: 90 })
    })
    expect(await api.getOwnerAccessToken()).toBe("short")
    expect(await api.getOwnerAccessToken()).toBe("short")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})


it("fails if the recovery lookup itself observes a second credential change", async () => {
  const api = await load()
  const row = deferred<OwnerConnectionRow>()
  db.getOwnerConnection.mockReturnValueOnce(row.promise).mockResolvedValue(connection("b"))
  const old = api.getOwnerAccessToken()
  const assertion = expect(old).rejects.toMatchObject({ statusCode: 502, message: "Dropbox connection changed. Please retry the operation." })
  await api.getOwnerAccessToken()
  db.getOwnerConnection.mockResolvedValue(connection("c"))
  row.resolve(connection("a"))
  await assertion
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fetchMock.mockResolvedValueOnce(json({ access_token: "token-c", expires_in: 3600 }))
  expect(await api.getOwnerAccessToken()).toBe("token-c")
  expect((fetchMock.mock.calls[1][1].body as URLSearchParams).get("refresh_token")).toBe("synthetic-refresh-c")
})
