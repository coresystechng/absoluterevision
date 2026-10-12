import { beforeEach, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }))
vi.mock("@neondatabase/serverless", () => ({ neon: database.connect }))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("VITE_NEON_BROWSER_URL", "postgres://browser:local@localhost/test")
  vi.stubEnv("VITE_NEON_DATABASE_URL", "postgres://legacy_owner:local@localhost/test")
  database.connect.mockReset().mockReturnValue(database)
  database.query.mockReset()
})

it("initializes the browser without DDL or data migrations", async () => {
  database.query.mockResolvedValue([])
  const { initDb } = await import("./db")
  await Promise.all([initDb(), initDb()])
  expect(database.query).toHaveBeenCalledTimes(1)
  expect(database.query.mock.calls[0][0]).toMatch(/^SELECT /)
  expect(database.connect.mock.calls[0][0]).toBe("postgres://browser:local@localhost/test")
})

it("allows retrying initialization after a connection failure", async () => {
  database.query.mockRejectedValueOnce(new Error("Connection failed")).mockResolvedValue([])
  const { initDb } = await import("./db")
  await expect(initDb()).rejects.toThrow("Connection failed")
  await initDb()
  expect(database.query).toHaveBeenCalledTimes(2)
})

it("does not fall back to the legacy owner connection", async () => {
  vi.stubEnv("VITE_NEON_BROWSER_URL", "")
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
  try {
    const { query } = await import("./db")
    await expect(query("SELECT 1")).rejects.toThrow("Missing VITE_NEON_BROWSER_URL")
    expect(database.connect).not.toHaveBeenCalled()
  } finally { warning.mockRestore() }
})
