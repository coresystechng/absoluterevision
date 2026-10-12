import { expect, test } from "@playwright/test"

const submission = {
  id: "b0d8c443-e1bc-49f1-8e68-f0f19c02a862", fullName: "Test Client", email: "client@example.com",
  submittedAt: "2026-10-12T10:00:00Z", convertedAt: null, assignmentId: null, teamId: null,
  files: [
    { index: 0, name: "Research manuscript.pdf", mimeType: "application/pdf", sizeBytes: 1048576, status: "ready" },
    { index: 1, name: "Figure 1.png", mimeType: "image/png", sizeBytes: 524288, status: "ready" },
  ],
}

test("admin inbox and conversion form work at desktop and mobile sizes", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  // Mock only the auth boundary and inbox HTTP responses; render the real page,
  // components, routing, and styles without connecting to a live account/database.
  await page.route("**/src/lib/auth.ts*", (route) => route.fulfill({ contentType: "application/javascript", body: `
    export const isNeonAuthConfigured = true;
    const user = { id: 'admin', email: 'admin@example.com', name: 'Admin' };
    export const getNeonAuthClient = () => ({
      useSession: () => ({ isPending: false, data: { user } }),
      getSession: async () => ({ data: { user, session: { token: 'test-token' } } }),
      signOut: async () => undefined
    });
  ` }))
  await page.route(/\/api\/client-submissions(?:\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "This submission was just assigned. Refresh the inbox." }) })
    } else {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        submissions: [submission], nextCursor: null,
        teams: [{ id: 1, name: "Editorial", members: [{ userId: "admin", email: "admin@example.com", displayName: "Admin" }, { userId: "editor", email: "editor@example.com", displayName: "Editor" }] }],
      }) })
    }
  })
  await page.goto("/client-submissions", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Client submissions" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Test Client" })).toBeVisible()
  await expect(page.getByText("Figure 1.png", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.screenshot({ path: testInfo.outputPath("client-submissions.png"), fullPage: true })
  await page.getByRole("button", { name: "Create assignment", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Assignee").selectOption("editor")
  await dialog.getByLabel("Assignment type").selectOption("Dissertation")
  await dialog.getByRole("button", { name: "Create assignment", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("just assigned")
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.screenshot({ path: testInfo.outputPath("submission-conversion.png"), fullPage: true })
  expect(errors).toEqual([])
})
