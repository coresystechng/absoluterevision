import { readFile } from "node:fs/promises"
import { test as base, expect } from "@playwright/test"
import { preview } from "vite"

const test = base.extend<{ productionUrl: string }>({
  productionUrl: async ({ request }, provide, testInfo) => {
    const port = 4180 + testInfo.workerIndex
    const server = await preview({ preview: { host: "127.0.0.1", port, strictPort: true } })
    const origin = `http://127.0.0.1:${port}`
    try {
      expect((await request.get(origin)).status()).toBe(200)
      await provide(origin)
    } finally {
      server.httpServer.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()))
    }
  },
})

test.use({ serviceWorkers: "block" })

test.describe("static marketing content", () => {
  test.use({ javaScriptEnabled: false })

  test("homepage and prices are readable with JavaScript disabled", async ({ page, productionUrl }, testInfo) => {
    const homepage = await page.goto(productionUrl)
    expect(homepage?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Academic Editing & Proofreading")
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
    const whatsappLinks = page.locator('a[href="https://wa.me/2349024364876"]')
    await expect(whatsappLinks).toHaveCount(3)
    for (const link of await whatsappLinks.all()) await expect(link.locator("svg")).toHaveCount(1)
    for (const email of await page.locator('a[href^="mailto:"]').all()) await expect(email).toHaveAttribute("href", "mailto:coresystechng@gmail.com")

    await page.locator("#faq summary").filter({ hasText: "What are your prices?" }).click()
    await page.getByRole("link", { name: "View our service prices, excluding VAT and transfer fees." }).click()
    await expect(page).toHaveURL(`${productionUrl}/pricing`)
    await expect(page).toHaveTitle("Editing & Proofreading Prices | Absolute Revision")
    for (const price of ["$40", "$113", "$150"]) await expect(page.getByText(price, { exact: false })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Custom projects & papers" })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://absoluterevision.com/pricing")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow, max-image-preview:large")
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}")
    const organization = schema["@graph"].find((entity: { "@type": string }) => entity["@type"] === "Organization")
    expect(organization.telephone).toBeUndefined()
    expect(organization.contactPoint.url).toBe("https://wa.me/2349024364876")
    expect(organization.email).toBe("coresystechng@gmail.com")
    await page.screenshot({ path: testInfo.outputPath("pricing.png"), fullPage: true })
  })

  test("unknown pages return a real 404 and usable navigation", async ({ page, productionUrl }) => {
    const response = await page.goto(`${productionUrl}/missing-marketing-page`)
    expect(response?.status()).toBe(404)
    await expect(page).toHaveURL(`${productionUrl}/missing-marketing-page`)
    await expect(page.getByRole("heading", { name: "We couldn't find that page." })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    await page.getByRole("link", { name: "Return home" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Academic Editing & Proofreading")
  })
})

test("public hydration has no errors and does not request workspace chunks", async ({ page, productionUrl }) => {
  const errors: string[] = []
  const workspaceRequests: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
  page.on("request", (request) => {
    if (/\/assets\/(?:auth|useTeams|Dashboard|Settings|AssignmentView|ClientSubmissions|Login|ProtectedRoute)-/.test(request.url())) workspaceRequests.push(request.url())
  })
  await page.goto(productionUrl)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Academic Editing & Proofreading")
  await page.locator("#faq summary").filter({ hasText: "What are your prices?" }).click()
  await page.getByRole("link", { name: "View our service prices, excluding VAT and transfer fees." }).click()
  await expect(page).toHaveTitle("Editing & Proofreading Prices | Absolute Revision")
  await expect(page.getByRole("heading", { name: "Clear pricing for your next paper." })).toBeVisible()
  expect(errors).toEqual([])
  expect(workspaceRequests).toEqual([])
})

test("built utility responses and redirects preserve the indexing contract", async ({ request, productionUrl }) => {
  for (const path of ["/login", "/sign-up", "/document-upload", "/track-assignment", "/dashboard", "/settings", "/client-submissions", "/assignments/42"]) {
    const response = await request.get(`${productionUrl}${path}?token=private-test-value`)
    expect(response.status(), path).toBe(200)
    expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).not.toContain("private-test-value")
    expect(html).toContain('name="robots" content="noindex, nofollow"')
  }
  for (const [path, destination] of [["/pricing/", "/pricing"], ["/pricing.html", "/pricing"], ["/index.html", "/"], ["/sign-in", "/login"]]) {
    const response = await request.get(`${productionUrl}${path}?campaign=test`, { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    expect(response.headers().location).toBe(`${destination}?campaign=test`)
  }
  const worker = await readFile("dist/sw.js", "utf8")
  expect(worker).not.toContain('url:"404.html"')
  for (const prefix of ["assets/auth-", "assets/useTeams-", "assets/Dashboard-", "assets/Settings-"]) expect(worker).not.toContain(prefix)
})

test("an installed service worker preserves real unknown-page 404 responses", async ({ browser, productionUrl }) => {
  const context = await browser.newContext({ serviceWorkers: "allow" })
  try {
    const page = await context.newPage()
    await page.goto(productionUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    const response = await page.goto(`${productionUrl}/unknown-after-service-worker`)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "We couldn't find that page." })).toBeVisible()
  } finally {
    await context.close()
  }
})


test("landing footer theme persists and FAQ works with keyboard", async ({ page, productionUrl }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
  await page.goto(productionUrl)
  await expect(page.locator("#contact form")).toHaveCount(0)
  await expect(page.locator("#faq h3")).toHaveCount(0)
  await expect(page.locator("#faq details")).toHaveCount(7)
  const question = page.locator("#faq summary").filter({ hasText: "What file type is accepted?" })
  await question.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByText("Preferably, submit your manuscript in MS Word format.")).toBeVisible()
  const preference = page.locator("footer").getByRole("group", { name: "Theme preference" })
  await expect(preference).toHaveText("")
  const termsBox = await page.getByRole("link", { name: "Site Terms", exact: true }).boundingBox()
  const preferenceBox = await preference.boundingBox()
  expect(preferenceBox!.x).toBeGreaterThan(termsBox!.x + termsBox!.width)
  expect(Math.abs(preferenceBox!.y - termsBox!.y)).toBeLessThan(24)
  await preference.getByRole("button", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(preference.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true")
  await preference.getByRole("button", { name: "Light", exact: true }).click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: "dark" })
  await preference.getByRole("button", { name: "System", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  expect(errors).toEqual([])
})


test("public pages share the same footer and theme controls", async ({ page, productionUrl }) => {
  let expectedLinks: Array<{ text: string; href: string | null }> | undefined
  for (const path of ["/", "/pricing", "/document-upload", "/track-assignment", "/missing-page"]) {
    await page.goto(productionUrl + path)
    const footer = page.locator("footer")
    await expect(footer).toHaveCount(1)
    const preferences = footer.getByRole("group", { name: "Theme preference" })
    await expect(preferences).toBeVisible()
    await expect(preferences).toHaveText("")
    const links = await footer.locator("a").evaluateAll((elements) => elements.map((element) => ({ text: element.textContent!.trim(), href: element.getAttribute("href") })))
    if (!expectedLinks) expectedLinks = links
    expect(links, path).toEqual(expectedLinks)
    await expect(page.locator("#top")).toHaveCount(1)
    await preferences.getByRole("button", { name: "Dark", exact: true }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), path).toBe(false)
  }
})


test("sign-in and sign-up pages exclude the public footer", async ({ page, productionUrl }) => {
  for (const path of ["/login", "/sign-up"]) {
    await page.goto(productionUrl + path)
    await expect(page.getByRole("heading", { name: path === "/login" ? /^(Sign in|Authentication is not configured)$/ : /^(Create your account|Authentication is not configured)$/ })).toBeVisible()
    await expect(page.locator("footer")).toHaveCount(0)
  }
})
