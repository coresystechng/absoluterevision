import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { renderPageHead } from "../../build/site-metadata"
import { getPageMetadata, siteMetadata, utilityPages } from "./site-metadata"

const template = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const deployment = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  trailingSlash: boolean
  redirects: { source: string; destination: string; permanent: boolean; has?: { type: string; value: string }[] }[]
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

describe("public HTML and indexing contracts", () => {
  it("ships descriptive homepage metadata and absolute social URLs before JavaScript runs", () => {
    const html = renderPageHead(template, "/")
    expect(html).toContain("Academic Editing &amp; Proofreading | Absolute Revision</title>")
    expect(html).toContain('name="robots" content="index, follow, max-image-preview:large"')
    expect(html).toContain('rel="canonical" href="https://absoluterevision.com/"')
    expect(html).toContain('property="og:url" content="https://absoluterevision.com/"')
    expect(html).toContain('property="og:image" content="https://absoluterevision.com/social/absolute-revision.png"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(html).toContain('property="og:image:width" content="1200"')
    expect(html).toContain('property="og:image:height" content="630"')
    expect(html.match(/<title\b/g)).toHaveLength(1)
  })

  it.each(Object.keys(utilityPages))("excludes %s and its trailing-slash variant without publishing query credentials", (path) => {
    const html = renderPageHead(template, `${path}/?token=private-test-value#private-fragment`)
    expect(html).toContain('name="robots" content="noindex, nofollow"')
    expect(html).not.toContain("private-test-value")
    expect(html).not.toContain("private-fragment")
    expect(getPageMetadata(`${path}/`).canonical).toBe(getPageMetadata(path).canonical)

    const headerRules = deployment.headers.filter((rule) => rule.headers.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex")))
    const covered = headerRules.some((rule) => {
      const pattern = rule.source.replace(/:page\(([^)]+)\)/, "($1)")
      return new RegExp(`^${pattern}$`).test(path)
    })
    expect(covered, `${path} must also be noindex at the HTTP layer`).toBe(true)

    const target = deployment.redirects.find((rule) => rule.source === path)?.destination ?? path
    expect(deployment.rewrites.find((rule) => rule.source === target)?.destination).toBe(`/_pages${target}.html`)
  })

  it("never publishes a private assignment ID or fabricates a canonical URL", () => {
    const html = renderPageHead(template, "/assignments/987654?accessCode=private-test-value")
    expect(html).toContain("Assignment | Absolute Revision</title>")
    expect(html).toContain('name="robots" content="noindex, nofollow"')
    expect(html).not.toContain("987654")
    expect(html).not.toContain("private-test-value")
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('property="og:url"')
    expect(deployment.headers.find((rule) => rule.source === "/assignments/:path*")?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" })
    expect(deployment.rewrites.find((rule) => rule.source === "/assignments/:id")?.destination).toBe("/_pages/assignment.html")
  })

  it("normalizes host, index document, sign-in alias, and trailing slashes", () => {
    expect(deployment.trailingSlash).toBe(false)
    expect(deployment.redirects).toContainEqual({ source: "/:path*", has: [{ type: "host", value: "www.absoluterevision.com" }], destination: "https://absoluterevision.com/:path*", permanent: true })
    expect(deployment.redirects).toContainEqual({ source: "/index.html", destination: "/", permanent: true })
    expect(deployment.redirects).toContainEqual({ source: "/sign-in", destination: "/login", permanent: true })
    expect(getPageMetadata("/sign-in").canonical).toBe("https://absoluterevision.com/login")
  })

  it("allows crawlers to read noindex rules and lists only canonical marketing pages", () => {
    const robots = readFileSync(new URL("../../public/robots.txt", import.meta.url), "utf8")
    const sitemap = readFileSync(new URL("../../public/sitemap.xml", import.meta.url), "utf8")
    expect(robots).toContain("User-agent: *")
    expect(robots).toContain("Allow: /")
    expect(robots).not.toMatch(/Disallow:\s*\/\S*/)
    expect(robots).toContain(`Sitemap: ${siteMetadata.origin}/sitemap.xml`)
    expect([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual(["https://absoluterevision.com/", "https://absoluterevision.com/pricing"])
  })

  it("provides a real PNG with dimensions matching its metadata", () => {
    const png = readFileSync(new URL("../../public/social/absolute-revision.png", import.meta.url))
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })

  it("fails a build with a missing metadata insertion region", () => {
    expect(() => renderPageHead("<html><head></head></html>", "/")).toThrow("missing its site-metadata region")
  })

  it("publishes accurate Organization, WebSite, and WebPage JSON-LD only on public pages", () => {
    for (const path of ["/", "/pricing"]) {
      const html = renderPageHead(template, path)
      const json = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1]
      expect(json).toBeDefined()
      const schema = JSON.parse(json!)
      expect(schema["@context"]).toBe("https://schema.org")
      const organization = schema["@graph"].find((entity: { "@type": string }) => entity["@type"] === "Organization")
      expect(organization.telephone).toBeUndefined()
      expect(organization.contactPoint.url).toBe("https://wa.me/2349024364876")
      expect(organization.email).toBe("coresystechng@gmail.com")
      expect(organization.sameAs).toHaveLength(3)
      expect(schema["@graph"].find((entity: { "@type": string }) => entity["@type"] === "WebPage").url).toBe(`https://absoluterevision.com${path}`)
    }
    expect(renderPageHead(template, "/dashboard")).not.toContain("application/ld+json")
  })
})
