import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => {
  process.env.NEON_DATABASE_URL = "postgres://postgres:local@localhost/test"
  process.env.VITE_NEON_BROWSER_URL = "postgres://browser_client:local@localhost/test"
  process.env.DROPBOX_OWNER_USER_ID = "owner"
  return { query: vi.fn() }
})
// Run the production migrations and SQL against an isolated PostgreSQL engine.
vi.mock("@neondatabase/serverless", () => ({ neon: () => database }))

import {
  authorizeSubmissionUpload, convertClientSubmission, createSubmissionIntake,
  finalizeSubmissionIntake, getSubmissionDownloadFile, initClientSubmissionsDb,
  listClientSubmissions, normalizeSubmissionAssignment, normalizeSubmissionIntake,
  recordSubmissionUpload, requireSubmissionsAdmin, retrySubmissionIntake, submissionBrowserRole,
} from "./client-submissions.js"
import type { ApiRequest } from "./http.js"

let pg: PGlite
beforeAll(async () => {
  pg = await PGlite.create()
  database.query.mockImplementation(async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows)
  await pg.exec("CREATE ROLE browser_client NOLOGIN")
  await initClientSubmissionsDb()
}, 60000)

beforeEach(async () => {
  await pg.exec("TRUNCATE client_submissions, assignments, teams, users RESTART IDENTITY CASCADE")
  await pg.exec(`INSERT INTO users (id, email) VALUES ('owner','owner@example.com'), ('admin','admin@example.com'), ('member','member@example.com'), ('outsider','outsider@example.com');
    INSERT INTO teams (id, name, admin_user_id) VALUES (1, 'Editorial', 'owner'), (2, 'Other team', 'outsider');
    INSERT INTO team_memberships (team_id, user_id, role) VALUES (1,'owner','admin'), (1,'admin','admin'), (1,'member','member'), (2,'outsider','admin')`)
})
afterAll(async () => { await pg?.close() })

const intakeBody = { fullName: "Test Client", email: "CLIENT@example.com", files: [{ name: "draft.pdf", size: 100, mimeType: "application/pdf" }, { name: "figure.png", size: 200, mimeType: "image/png" }] }
const actor = { id: "admin", email: "admin@example.com", name: "Admin" }
const conversion = (submissionId: string) => ({ submissionId, title: "Client project", teamId: 1, assigneeUserId: "member", category: "Design", priority: "high", dueDate: "2026-12-20", notes: "Check the figures" })
const accessRequest = (intake: { submissionId: string; token: string }, fileIndex: number) => ({ headers: {
  "x-submission-id": intake.submissionId, "x-submission-token": intake.token, "x-submission-file-index": String(fileIndex),
} }) as unknown as ApiRequest

async function readyIntake() {
  const intake = await createSubmissionIntake(intakeBody)
  for (const [index, file] of intakeBody.files.entries()) await recordSubmissionUpload(accessRequest(intake, index), { providerFileId: `${intake.submissionId}-${index}`, folderPath: "/client", name: file.name, sizeBytes: file.size })
  await finalizeSubmissionIntake(intake)
  return intake
}

describe("client submissions on PostgreSQL", () => {
  it("requires different database roles for private intake data", () => {
    expect(() => submissionBrowserRole("postgres://owner@localhost/db", "postgres://owner@localhost/db")).toThrow("separate")
    expect(() => submissionBrowserRole(undefined, "postgres://browser@localhost/db")).toThrow("separate")
    expect(submissionBrowserRole("postgres://server@localhost/db", "postgres://browser@localhost/db")).toBe("browser")
  })

  it("denies direct reads from the browser database role", async () => {
    await pg.exec("GRANT USAGE ON SCHEMA public TO browser_client; SET ROLE browser_client")
    try { await expect(pg.query("SELECT * FROM client_submissions")).rejects.toThrow("permission denied") }
    finally { await pg.exec("RESET ROLE") }
  })

  it("groups mixed files and exposes client details without upload secrets", async () => {
    await readyIntake()
    const page = await listClientSubmissions("admin", { search: "", status: "new", cursor: null })
    expect(page.submissions).toHaveLength(1)
    expect(page.submissions[0]).toMatchObject({ fullName: "Test Client", email: "client@example.com", assignmentId: null })
    expect(page.submissions[0].files.map((file) => file.name)).toEqual(["draft.pdf", "figure.png"])
    expect(JSON.stringify(page)).not.toContain("token")
    expect(page.teams.map((team) => team.id)).toEqual([1])
  })

  it("allows the Dropbox owner and their admins, and rejects members and unrelated admins", async () => {
    await expect(requireSubmissionsAdmin("owner")).resolves.toBe("owner")
    await expect(requireSubmissionsAdmin("admin")).resolves.toBe("owner")
    await expect(requireSubmissionsAdmin("member")).rejects.toMatchObject({ statusCode: 403 })
    await expect(requireSubmissionsAdmin("outsider")).rejects.toMatchObject({ statusCode: 403 })
  })

  it("rejects forged upload credentials and changed file metadata", async () => {
    const intake = await createSubmissionIntake(intakeBody)
    await expect(authorizeSubmissionUpload(accessRequest({ ...intake, token: "b".repeat(64) }, 0))).rejects.toMatchObject({ statusCode: 403 })
    await expect(authorizeSubmissionUpload(accessRequest(intake, 0), { fullName: "Test Client", email: "client@example.com", fileName: "other.pdf", totalSize: 100, mimeType: "application/pdf" })).rejects.toMatchObject({ statusCode: 400 })
    await expect(authorizeSubmissionUpload(accessRequest(intake, 0))).resolves.toMatchObject({ file: { name: "draft.pdf" } })
  })

  it("converts once and commits files, contact notes, correct workflow, and activity together", async () => {
    const intake = await readyIntake()
    const ids = await Promise.all([convertClientSubmission(actor, conversion(intake.submissionId)), convertClientSubmission(actor, conversion(intake.submissionId))])
    expect(ids[0]).toBe(ids[1])
    const assignments = await pg.query<{ id: number; progress_stage: string; notes: string; assignee_user_id: string }>("SELECT * FROM assignments")
    expect(assignments.rows).toHaveLength(1)
    expect(assignments.rows[0]).toMatchObject({ progress_stage: "concept", assignee_user_id: "member" })
    expect(assignments.rows[0].notes).toContain("client@example.com")
    const files = await pg.query<{ category: string }>("SELECT * FROM assignment_files")
    expect(files.rows).toHaveLength(2)
    expect(files.rows.every((file) => file.category === "brief")).toBe(true)
    expect((await pg.query("SELECT * FROM assignment_activities")).rows).toHaveLength(1)
    expect((await listClientSubmissions("admin", { search: "", status: "converted", cursor: null })).submissions[0].assignmentId).toBe(ids[0])
    await expect(authorizeSubmissionUpload(accessRequest(intake, 0))).rejects.toMatchObject({ statusCode: 403 })
  })

  it("blocks conversion while files are pending and permits conversion of finalized partial uploads", async () => {
    const intake = await createSubmissionIntake(intakeBody)
    await recordSubmissionUpload(accessRequest(intake, 0), { providerFileId: "draft-file", folderPath: "/client", name: "draft.pdf", sizeBytes: 100 })
    await expect(convertClientSubmission(actor, conversion(intake.submissionId))).rejects.toMatchObject({ statusCode: 409 })
    expect((await pg.query("SELECT * FROM assignments")).rows).toHaveLength(0)
    await finalizeSubmissionIntake(intake)
    await expect(convertClientSubmission(actor, conversion(intake.submissionId))).resolves.toBeTypeOf("number")
    expect((await pg.query("SELECT * FROM assignment_files")).rows).toHaveLength(1)
  })

  it("rolls back the assignment and conversion marker if attaching a file fails", async () => {
    const intake = await readyIntake()
    const existing = await pg.query<{ id: number }>("INSERT INTO assignments (user_id, team_id, title) VALUES ('owner', 1, 'Existing assignment') RETURNING id")
    await pg.query("INSERT INTO assignment_files (assignment_id, user_id, provider_file_id, name, mime_type) VALUES ($1, 'owner', $2, 'Existing file', 'application/pdf')", [existing.rows[0].id, `${intake.submissionId}-0`])
    await expect(convertClientSubmission(actor, conversion(intake.submissionId))).rejects.toThrow()
    expect((await pg.query("SELECT * FROM assignments")).rows).toHaveLength(1)
    expect((await pg.query("SELECT * FROM assignment_activities")).rows).toHaveLength(0)
    expect((await pg.query<{ assignment_id: number | null; converted_at: string | null }>("SELECT assignment_id, converted_at FROM client_submissions")).rows[0]).toEqual({ assignment_id: null, converted_at: null })
  })

  it("limits converted submissions to the assigned team's admins and the owner", async () => {
    await pg.exec("INSERT INTO teams (id, name, admin_user_id) VALUES (3, 'Design', 'owner'); INSERT INTO team_memberships (team_id, user_id, role) VALUES (3, 'outsider', 'admin'), (3, 'owner', 'admin')")
    const intake = await readyIntake()
    expect((await listClientSubmissions("outsider", { search: "", status: "new", cursor: null })).submissions).toHaveLength(1)
    await convertClientSubmission(actor, conversion(intake.submissionId))
    expect((await listClientSubmissions("outsider", { search: "", status: "converted", cursor: null })).submissions).toHaveLength(0)
    await expect(getSubmissionDownloadFile("outsider", intake.submissionId, 0)).rejects.toMatchObject({ statusCode: 404 })
    expect((await listClientSubmissions("owner", { search: "", status: "converted", cursor: null })).submissions).toHaveLength(1)
  })

  it("retries failed files within the same submission without losing ready files", async () => {
    const intake = await createSubmissionIntake(intakeBody)
    await recordSubmissionUpload(accessRequest(intake, 0), { providerFileId: "draft-file", folderPath: "/client", name: "draft.pdf", sizeBytes: 100 })
    await finalizeSubmissionIntake(intake)
    await retrySubmissionIntake(intake)
    const page = await listClientSubmissions("owner", { search: "", status: "new", cursor: null })
    expect(page.submissions[0].files.map((file) => file.status)).toEqual(["ready", "pending"])
    await recordSubmissionUpload(accessRequest(intake, 1), { providerFileId: "image-file", folderPath: "/client", name: "figure.png", sizeBytes: 200 })
    await finalizeSubmissionIntake(intake)
    expect((await pg.query("SELECT * FROM client_submissions")).rows).toHaveLength(1)
  })

  it("expires abandoned uploads and allows admins to recover their ready files", async () => {
    const intake = await createSubmissionIntake(intakeBody)
    await recordSubmissionUpload(accessRequest(intake, 0), { providerFileId: "draft-file", folderPath: "/client", name: "draft.pdf", sizeBytes: 100 })
    await pg.query("UPDATE client_submissions SET submitted_at = NOW() - INTERVAL '25 hours' WHERE id = $1", [intake.submissionId])
    await expect(authorizeSubmissionUpload(accessRequest(intake, 1))).rejects.toMatchObject({ statusCode: 403 })
    const page = await listClientSubmissions("admin", { search: "", status: "new", cursor: null })
    expect(page.submissions[0].files.map((file) => file.status)).toEqual(["ready", "failed"])
    await expect(convertClientSubmission(actor, conversion(intake.submissionId))).resolves.toBeTypeOf("number")
  })

  it("denies conversion into unrelated teams and downloading missing files", async () => {
    const intake = await readyIntake()
    await expect(convertClientSubmission(actor, { ...conversion(intake.submissionId), teamId: 2, assigneeUserId: "outsider" })).rejects.toMatchObject({ statusCode: 403 })
    await expect(convertClientSubmission(actor, { ...conversion(intake.submissionId), assigneeUserId: "outsider" })).rejects.toMatchObject({ statusCode: 403 })
    await expect(getSubmissionDownloadFile("member", intake.submissionId, 0)).rejects.toMatchObject({ statusCode: 403 })
    await expect(getSubmissionDownloadFile("admin", intake.submissionId, 0)).resolves.toBe(`${intake.submissionId}-0`)
    await expect(getSubmissionDownloadFile("admin", intake.submissionId, 2)).rejects.toMatchObject({ statusCode: 404 })
  })

  it("searches and paginates without exposing another owner's submissions", async () => {
    for (let index = 0; index < 27; index++) await createSubmissionIntake({ ...intakeBody, fullName: `Client ${index}` })
    await pg.query("UPDATE client_submissions SET submitted_at = '2026-10-12T10:00:00.123456Z'")
    const first = await listClientSubmissions("admin", { search: "", status: "new", cursor: null })
    const second = await listClientSubmissions("admin", { search: "", status: "new", cursor: first.nextCursor })
    expect(first.submissions).toHaveLength(25)
    expect(second.submissions).toHaveLength(2)
    expect(new Set([...first.submissions, ...second.submissions].map((item) => item.id)).size).toBe(27)
    expect((await listClientSubmissions("admin", { search: "Client 26", status: "new", cursor: null })).submissions).toHaveLength(1)
    await pg.query("UPDATE client_submissions SET owner_user_id = 'outsider'")
    expect((await listClientSubmissions("owner", { search: "", status: "all", cursor: null })).submissions).toHaveLength(0)
  })

  it("validates manifests and conversion dates before database writes", () => {
    expect(() => normalizeSubmissionIntake({ ...intakeBody, files: Array(4).fill(intakeBody.files[0]) })).toThrow("3")
    expect(() => normalizeSubmissionIntake({ ...intakeBody, files: [{ name: "script.exe", size: 100 }] })).toThrow("supported image")
    expect(() => normalizeSubmissionAssignment({ ...conversion("b0d8c443-e1bc-49f1-8e68-f0f19c02a862"), dueDate: "2026-02-30" })).toThrow("deadline")
  })
})
