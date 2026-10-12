import { beforeEach, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@neondatabase/serverless", () => ({ neon: () => database }))

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("VITE_NEON_DATABASE_URL", "postgres://browser:local@localhost/test")
  database.query.mockReset()
})

it("initializes the browser without DDL or data migrations", async () => {
  database.query.mockResolvedValue([])
  const { initDb } = await import("./db")
  await Promise.all([initDb(), initDb()])
  expect(database.query).toHaveBeenCalledTimes(1)
  expect(database.query.mock.calls[0][0]).toMatch(/^SELECT /)
})

it("allows retrying initialization after a connection failure", async () => {
  database.query.mockRejectedValueOnce(new Error("Connection failed")).mockResolvedValue([])
  const { initDb } = await import("./db")
  await expect(initDb()).rejects.toThrow("Connection failed")
  await initDb()
  expect(database.query).toHaveBeenCalledTimes(2)
})
