import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("public and utility responses expose metadata without JavaScript", async ({ request }) => {
  const homepage = await request.get("/")
  expect(homepage.status()).toBe(200)
  const homeHtml = await homepage.text()
  expect(homeHtml).toContain("Academic Editing &amp; Proofreading | Absolute Revision</title>")
  expect(homeHtml).toContain('rel="canonical" href="https://absoluterevision.com/"')
  expect(homeHtml).toContain('property="og:image" content="https://absoluterevision.com/social/absolute-revision.png"')
  expect(homeHtml).toContain("Academic Editing &amp; Proofreading for Your Research Papers</h1>")

  for (const path of ["/login", "/sign-in", "/sign-up", "/dashboard", "/settings", "/document-upload", "/track-assignment/", "/client-submissions/", "/assignments/987654"]) {
    const response = await request.get(`${path}?accessCode=private-test-value`)
    expect(response.status(), path).toBe(200)
    const html = await response.text()
    expect(html, path).toContain('name="robots" content="noindex, nofollow"')
    expect(html, path).not.toContain("private-test-value")
    expect(html, path).not.toContain("987654")
    expect(html.match(/<title\b/g), path).toHaveLength(1)
  }
})

test("crawler files and social image are served as their real resource types", async ({ request }) => {
  const robots = await request.get("/robots.txt")
  expect(robots.status()).toBe(200)
  expect(robots.headers()["content-type"]).toContain("text/plain")
  expect(await robots.text()).toContain("Sitemap: https://absoluterevision.com/sitemap.xml")

  const sitemap = await request.get("/sitemap.xml")
  expect(sitemap.status()).toBe(200)
  expect(sitemap.headers()["content-type"]).toMatch(/(?:application|text)\/xml/)
  expect(await sitemap.text()).toContain("<loc>https://absoluterevision.com/</loc>")

  const image = await request.get("/social/absolute-revision.png")
  expect(image.status()).toBe(200)
  expect(image.headers()["content-type"]).toContain("image/png")
  const png = await image.body()
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
})

test("client navigation updates metadata and restores homepage indexing", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle("Academic Editing & Proofreading | Absolute Revision")
  await page.getByRole("link", { name: "Check assignment status", exact: true }).click()
  await expect(page).toHaveTitle("Track Your Assignment | Absolute Revision")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://absoluterevision.com/track-assignment")

  await page.goBack()
  await expect(page).toHaveTitle("Academic Editing & Proofreading | Absolute Revision")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow, max-image-preview:large")
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Academic Editing & Proofreading | Absolute Revision")
  for (const selector of ["title", 'meta[name="description"]', 'meta[name="robots"]', 'link[rel="canonical"]']) {
    await expect(page.locator(selector)).toHaveCount(1)
  }
})
