import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({ initFilesDb: vi.fn(), query: vi.fn() }))
vi.mock("./db.js", () => db)

import { createTeamSignupInvite, listTeamSignupInvites, redeemSignupInvite, releaseSignupInvite, reserveSignupInvite } from "./signup-invites.js"

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

  it("denies token generation and listing to non-admins", async () => {
    db.query.mockResolvedValue([])
    await expect(createTeamSignupInvite("member", 1, email)).rejects.toThrow("Only this team's admins")
    await expect(listTeamSignupInvites("member", 1)).rejects.toThrow("Only this team's admins")
    expect(db.query.mock.calls.every(([sql]) => sql.startsWith("SELECT id FROM team_memberships"))).toBe(true)
  })

  it("creates an email-bound expiring code for the admin's team", async () => {
    db.query.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: "2", expires_at: "2026-10-13T00:00:00Z" }])
    const result = await createTeamSignupInvite("admin", 12, ` ${email.toUpperCase()} `)
    expect(result.token).toMatch(/^INV-[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/)
    expect(result.email).toBe(email)
    expect(db.query.mock.calls[1][1]).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/), 12, "admin", email])
    expect(db.query.mock.calls[1][0]).toContain("INTERVAL '7 days'")
  })

  it("refuses redemption for a different authenticated email", async () => {
    await expect(redeemSignupInvite(token, email, "receipt", { id: "attacker", email: "other@example.com", name: null })).resolves.toBe(false)
    expect(db.query).not.toHaveBeenCalled()
  })

  it("redeems and joins the issuing team atomically with a verified identity", async () => {
    db.query.mockResolvedValue([{ id: 1 }])
    await expect(redeemSignupInvite(token, email, "receipt", { id: "new-user", email, name: "New User" })).resolves.toBe(true)
    const [sql, params] = db.query.mock.calls[0]
    expect(sql).toContain("INSERT INTO team_memberships")
    expect(sql).toContain("revoked_at IS NULL")
    expect(sql).toContain("expires_at > NOW()")
    expect(params.slice(3)).toEqual(["new-user", "New User"])
  })
})
