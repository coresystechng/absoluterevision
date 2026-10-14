import { readFile, mkdir } from "node:fs/promises"
import { test as base, expect } from "@playwright/test"
import { preview } from "vite"
import path from "node:path"
import { getPublicScriptDependencies } from "../build/prerender"
import { generateSW } from "workbox-build"

const test = base.extend<{ productionUrl: string; workerUpgrade: { origin: string; upgrade: () => void } }>({
  workerUpgrade: async ({ request }, provide, testInfo) => {
    const fixtureDirectory = testInfo.outputPath("legacy-worker")
    await mkdir(fixtureDirectory, { recursive: true })
    const publicScripts = await getPublicScriptDependencies(path.resolve("dist"))
    await generateSW({
      globDirectory: path.resolve("dist"), globPatterns: ["**/*.{js,css,html}", "icons/*.png", "manifest.webmanifest"],
      globIgnores: ["sw.js", "workbox-*.js"], swDest: path.join(fixtureDirectory, "sw.js"),
      skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true,
      navigateFallback: "index.html", navigateFallbackDenylist: [/^\/api\//],
      navigateFallbackAllowlist: [/^\/$/, /^\/(?:pricing|login|sign-in|sign-up|document-upload|track-assignment|dashboard|client-submissions|settings)\/?$/, /^\/assignments\/[^/]+\/?$/],
      manifestTransforms: [async (entries) => ({ manifest: entries.filter((entry) => entry.url !== "404.html" && (!entry.url.endsWith(".js") || entry.url === "registerSW.js" || publicScripts.has(entry.url))), warnings: [] })],
      runtimeCaching: [{ urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"), handler: "CacheFirst", options: { cacheName: "application-chunks", expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [200] } } }],
    })
    let upgraded = false
    const port = 4280 + testInfo.workerIndex
    const server = await preview({
      preview: { host: "127.0.0.1", port, strictPort: true },
      plugins: [{ name: "isolated-worker-upgrade", configurePreviewServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = new URL(req.url ?? "/", "http://localhost").pathname
          if (pathname !== "/sw.js" && !/^\/workbox-[\w-]+\.js$/.test(pathname)) return next()
          try {
            const source = pathname === "/sw.js" && upgraded ? path.resolve("dist/sw.js") : path.join(fixtureDirectory, pathname.slice(1))
            res.setHeader("Content-Type", "application/javascript")
            res.setHeader("Cache-Control", "no-store")
            res.end(await readFile(source))
          } catch (error) { next(error) }
        })
      } }],
    })
    try {
      expect((await request.get(`http://127.0.0.1:${port}`)).status()).toBe(200)
      await provide({ origin: `http://127.0.0.1:${port}`, upgrade: () => { upgraded = true } })
    }
    finally {
      server.httpServer.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()))
    }
  },
  productionUrl: async ({ request }, provide, testInfo) => {
    const port = 4180 + testInfo.workerIndex
    const server = await preview({ preview: { host: "127.0.0.1", port, strictPort: true }, plugins: [{
      name: "synthetic-api-navigation-probe", configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== "/api/worker-navigation-probe") return next()
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ probe: "network-api-response" }))
        })
      },
    }] })
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

test("public import graph excludes workspace query modules", async () => {
  const outputDirectory = path.resolve("dist")
  const metadata = JSON.parse(await readFile("node_modules/.cache/absolute-revision-bundle-analysis/modules.json", "utf8")) as { outputDirectory: string; chunks: Record<string, string[]> }
  expect(metadata.outputDirectory).toBe(outputDirectory)
  const graph = await getPublicScriptDependencies(outputDirectory)
  expect(graph.size).toBeGreaterThan(0)
  for (const chunk of graph) {
    expect(metadata.chunks[chunk], chunk).toBeDefined()
    for (const moduleId of metadata.chunks[chunk]) {
      expect(moduleId, chunk).not.toMatch(/src\/(?:components\/WorkspaceProvider\.tsx|hooks\/useWorkspace\.ts|lib\/workspace-cache\.ts)|node_modules\/@tanstack\/(?:react-query|query-core)\//)
    }
  }
})

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
    for (const [route, title, marker] of [["/", "Academic Editing &amp; Proofreading | Absolute Revision", "/"], ["/pricing", "Editing &amp; Proofreading Prices | Absolute Revision", "/pricing"]]) {
      const document = await page.goto(productionUrl + route)
      expect(document?.status()).toBe(200)
      const html = await document!.text()
      expect(html).toContain(`<title data-site-metadata>${title}</title>`)
      expect(html).toContain(`data-prerendered="${marker}"`)
      expect(html).toContain(`href="https://absoluterevision.com${route}"`)
      expect(html).toContain('name="robots" content="index, follow, max-image-preview:large"')
    }
    const dashboard = await page.goto(productionUrl + "/dashboard")
    const dashboardHtml = await dashboard!.text()
    expect(dashboardHtml).toContain('<title data-site-metadata>Dashboard | Absolute Revision</title>')
    expect(dashboardHtml).toContain('name="robots" content="noindex, nofollow"')
    expect(dashboardHtml).toContain('<div id="root"></div>')
    expect(dashboardHtml).not.toContain('data-prerendered=')
    const response = await page.goto(`${productionUrl}/unknown-after-service-worker`)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: "We couldn't find that page." })).toBeVisible()
  } finally {
    await context.close()
  }
})

test("controlled navigation serves static route documents online and offline", async ({ browser, productionUrl }) => {
  const context = await browser.newContext({ serviceWorkers: "allow" })
  try {
    const page = await context.newPage()
    await page.goto(productionUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    expect(await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)).toBe(productionUrl + "/sw.js")
    const keys = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((name) => name.includes("precache"))
      return (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname.slice(1))))).flat()
    })
    const graph = await getPublicScriptDependencies(path.resolve("dist"))
    expect(keys.filter((key) => key.endsWith(".js")).sort()).toEqual([...graph, "registerSW.js"].sort())
    expect(keys).not.toContain("404.html")
    for (const document of ["pricing.html", "_pages/dashboard.html", "_pages/login.html", "_pages/assignment.html"]) expect(keys).toContain(document)
    // Leave the worker running while suppressing application execution: assertions
    // concern original navigation responses, including never-visited private routes.
    await context.route("**/assets/*.js", (route) => route.fulfill({ contentType: "application/javascript", body: "" }))
    const documents = [
      ["/", "Academic Editing &amp; Proofreading", "/"],
      ["/pricing", "Editing &amp; Proofreading Prices", "/pricing"],
      ["/pricing/", "Editing &amp; Proofreading Prices", "/pricing"],
      ["/dashboard", "Dashboard", "/dashboard"], ["/login", "Sign In", "/login"],
      ["/dashboard///", "Dashboard", "/dashboard"],
      ["/sign-in/", "Sign In", "/login"], ["/sign-up", "Create an Account", "/sign-up"],
      ["/document-upload", "Submit Your Manuscript", "/document-upload"],
      ["/track-assignment", "Track Your Assignment", "/track-assignment"],
      ["/settings", "Settings", "/settings"], ["/client-submissions", "Client Submissions", "/client-submissions"],
      ["/assignments/42", "Assignment", ""],
      ["/assignments/42///", "Assignment", ""],
    ]
    for (const offline of [false, true]) {
      await context.setOffline(offline)
      for (const [pathname, title, canonical] of documents) {
        const response = await page.goto(`${productionUrl}${pathname}?token=synthetic-private-value`, { waitUntil: "domcontentloaded" })
        expect(response?.status(), `${pathname} offline=${offline}`).toBe(200)
        expect(response?.fromServiceWorker()).toBe(true)
        const html = await response!.text()
        expect(html).toContain(`<title data-site-metadata>${title} | Absolute Revision</title>`)
        expect(html).not.toContain("synthetic-private-value")
        if (canonical) expect(html).toContain(`rel="canonical" href="https://absoluterevision.com${canonical}"`)
        else {
          expect(html).not.toContain('rel="canonical"')
          expect(html).not.toContain("/assignments/42")
        }
        if (pathname === "/" || pathname.startsWith("/pricing")) {
          expect(html).toContain(`data-prerendered="${canonical}"`)
          expect(html).toContain('name="robots" content="index, follow, max-image-preview:large"')
          if (pathname.startsWith("/pricing")) expect(html).toContain("Clear pricing for your next paper.")
        } else {
          expect(html).toContain('name="robots" content="noindex, nofollow"')
          expect(html).toContain('<div id="root"></div>')
          expect(html).not.toContain('data-prerendered=')
          expect(html).not.toContain("Academic Editing &amp; Proofreading")
        }
      }
    }
    await expect(page.goto(productionUrl + "/offline-unknown")).rejects.toThrow()
    await context.setOffline(false)
    expect((await page.goto(productionUrl + "/online-unknown"))?.status()).toBe(404)
    const api = await page.goto(productionUrl + "/api/worker-navigation-probe")
    expect(api?.status()).toBe(200)
    expect(api?.fromServiceWorker()).toBe(false)
    expect(await api!.text()).toContain("network-api-response")
    expect(await api!.text()).not.toContain('data-site-metadata')
  } finally { await context.setOffline(false); await context.close() }
})

test("a generated worker upgrades at sw.js without reloading the controlled page", async ({ browser, workerUpgrade }) => {
  const context = await browser.newContext({ serviceWorkers: "allow" })
  try {
    const page = await context.newPage()
    await page.goto(workerUpgrade.origin)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    const legacyResponse = await page.goto(workerUpgrade.origin + "/dashboard")
    expect(await legacyResponse!.text()).toContain('data-prerendered="/"')
    await page.goto(workerUpgrade.origin)
    let navigations = 0
    page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations++ })
    await page.evaluate(() => {
      const sentinel = document.createElement("div")
      sentinel.id = "worker-upgrade-sentinel"
      document.body.append(sentinel)
      navigator.serviceWorker.addEventListener("controllerchange", () => { sentinel.dataset.changed = "true" }, { once: true })
    })
    workerUpgrade.upgrade()
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
    await expect(page.locator("#worker-upgrade-sentinel")).toHaveAttribute("data-changed", "true")
    expect(await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)).toBe(workerUpgrade.origin + "/sw.js")
    expect(navigations).toBe(0)
    const mapped = await page.goto(workerUpgrade.origin + "/dashboard?token=synthetic-upgrade-value")
    expect(mapped?.fromServiceWorker()).toBe(true)
    const html = await mapped!.text()
    expect(html).toContain('<title data-site-metadata>Dashboard | Absolute Revision</title>')
    expect(html).toContain('<div id="root"></div>')
    expect(html).not.toContain('data-prerendered=')
    expect(html).not.toContain("synthetic-upgrade-value")
  } finally { await context.close() }
})

test("controlled public hydration has no errors", async ({ browser, productionUrl }) => {
  const context = await browser.newContext({ serviceWorkers: "allow" })
  try {
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
    await page.goto(productionUrl)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Academic Editing & Proofreading")
    await page.goto(productionUrl + "/pricing?campaign=synthetic")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Clear pricing for your next paper.")
    expect(errors).toEqual([])
  } finally { await context.close() }
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


test("clients verify email without an account before uploading", async ({ page, productionUrl }) => {
  const intakes: Record<string, unknown>[] = []
  await page.route("**/api/client-submissions/verify-email", async (route) => {
    const body = route.request().postDataJSON()
    if (body.action === "send") return route.fulfill({ json: { challengeId: "test-challenge", expiresIn: 600 } })
    return body.code === "123456"
      ? route.fulfill({ json: { verificationToken: "a".repeat(64), expiresIn: 1800 } })
      : route.fulfill({ status: 400, json: { error: "The code is invalid or expired." } })
  })
  await page.route("**/api/client-submissions/intake", async (route) => {
    const body = route.request().postDataJSON()
    if (body.action === "create") {
      intakes.push(body)
      expect(body.verificationToken).toBe("a".repeat(64))
      return route.fulfill({ json: { submissionId: "test-submission", token: "b".repeat(64) } })
    }
    return route.fulfill({ json: { finalized: true } })
  })
  await page.route("**/api/document-upload", (route) => route.fulfill({ json: { upload: { fileName: "draft.pdf", sizeBytes: 7, submittedAt: new Date().toISOString() } } }))
  await page.goto(productionUrl + "/document-upload")
  await page.getByLabel("Full Name", { exact: true }).fill("Test Client")
  await page.getByLabel("Email Address", { exact: true }).fill("client@example.com")
  await page.getByLabel("Documents or images").setInputFiles({ name: "draft.pdf", mimeType: "application/pdf", buffer: Buffer.from("content") })
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Send verification code" }).click()
  await page.getByLabel("Verification code").fill("000000")
  await page.getByRole("button", { name: "Verify email", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("invalid or expired")
  await page.getByLabel("Verification code").fill("123456")
  await page.getByRole("button", { name: "Verify email", exact: true }).click()
  await expect(page.getByText("Email verified", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Submit", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Submission received")
  expect(intakes).toHaveLength(1)
  await expect(page.getByText(/not converted to assignments expire after 14 days/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
