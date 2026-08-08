import { expect, test, type Page } from "@playwright/test"

const assignment = {
  reference: "AR-902AF8",
  category: "Dissertation",
  status: "ongoing",
  progressStage: "humaned",
  progress: 35,
  dueDate: "2026-09-01",
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))
  return errors
}

test("landing and tracking pages render without browser errors", async ({ page }) => {
  const errors = collectBrowserErrors(page)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await page.goto("/track-assignment", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Check your assignment progress" })).toBeVisible()
  expect(errors).toEqual([])
})

test("tracking form has a usable mobile layout and keyboard order", async ({ page }, testInfo) => {
  await page.goto("/track-assignment", { waitUntil: "domcontentloaded" })
  const reference = page.getByLabel("Assignment reference")
  const accessCode = page.getByLabel("Access code")
  const submit = page.getByRole("button", { name: "Check progress" })

  await reference.focus()
  await page.keyboard.press("Tab")
  await expect(accessCode).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(submit).toBeFocused()

  if (testInfo.project.name === "mobile-chromium") {
    const formBox = await page.locator("form").boundingBox()
    expect(formBox).not.toBeNull()
    expect(formBox!.x).toBeGreaterThanOrEqual(0)
    expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(390)
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasHorizontalOverflow).toBe(false)
  }
})

test("tracking displays a fabricated not-found response", async ({ page }) => {
  await page.route("**/api/assignment-status", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: "Not found" }),
  }))
  await page.goto("/track-assignment", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Assignment reference").fill(assignment.reference)
  await page.getByLabel("Access code").fill("7A91F2-88C4D0-1B6E35")
  await page.getByRole("button", { name: "Check progress" }).click()
  await expect(page.getByText(/could not verify those details/i)).toBeVisible()
})

test("tracking displays and focuses a fabricated successful response", async ({ page }) => {
  await page.route("**/api/assignment-status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ assignment }),
  }))
  await page.goto("/track-assignment", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Assignment reference").fill(assignment.reference)
  await page.getByLabel("Access code").fill("7A91F2-88C4D0-1B6E35")
  await page.getByRole("button", { name: "Check progress" }).click()

  const resultHeading = page.getByRole("heading", { name: "Dissertation" })
  await expect(resultHeading).toBeVisible()
  await expect(resultHeading).toBeFocused()
  await expect(page.getByText(`Reference ${assignment.reference}`)).toBeVisible()
})
