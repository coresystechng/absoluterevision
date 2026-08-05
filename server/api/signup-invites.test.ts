import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({ initFilesDb: vi.fn(), query: vi.fn() }))
vi.mock("./db.js", () => db)

import { redeemSignupInvite, releaseSignupInvite, reserveSignupInvite } from "./signup-invites.js"

const token = "INV-ABCDEF-123456-7890AB"
const email = "client@example.com"

beforeEach(() => {
  vi.resetAllMocks()
  db.initFilesDb.mockResolvedValue(undefined)
})

describe("signup invitations", () => {
  it("reserves a valid token without sending plaintext to Postgres", async () => {
    db.query.mockResolvedValue([{ id: 1 }])
    const receipt = await reserveSignupInvite(token.toLowerCase(), ` ${email.toUpperCase()} `)
    expect(receipt).toBeTruthy()
    const [, params] = db.query.mock.calls[0]
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(params[0]).not.toBe(token)
    expect(params[1]).toBe(email)
    expect(params[2]).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects malformed and unavailable tokens", async () => {
    await expect(reserveSignupInvite("bad-token", email)).resolves.toBeNull()
    expect(db.query).not.toHaveBeenCalled()
    db.query.mockResolvedValue([])
    await expect(reserveSignupInvite(token, email)).resolves.toBeNull()
  })

  it("redeems and releases only matching reservations", async () => {
    db.query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([])
    await expect(redeemSignupInvite(token, email, "receipt")).resolves.toBe(true)
    await expect(releaseSignupInvite(token, email, "receipt")).resolves.toBeUndefined()
    for (const call of db.query.mock.calls) {
      expect(call[1][0]).toMatch(/^[0-9a-f]{64}$/)
      expect(call[1][2]).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})
