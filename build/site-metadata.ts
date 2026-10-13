import type { Plugin } from "vite"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { insertPublicContent, prerenderPublicPages } from "./prerender"

import { getMetadataTags, getPageMetadata, publicPages, utilityPages } from "../src/lib/site-metadata"

const metadataRegion = /<!-- site-metadata:start -->[\s\S]*?<!-- site-metadata:end -->/

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function renderPageHead(html: string, pathname: string) {
  if (!metadataRegion.test(html)) throw new Error("The HTML template is missing its site-metadata region.")
  const tags = getMetadataTags(getPageMetadata(pathname)).map(({ tag, attributes, text }) => {
    const attrs = Object.entries(attributes).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join("")
    const content = tag === "title" ? `${escapeHtml(text ?? "")}</title>` : tag === "script" ? `${text ?? ""}</script>` : ""
    return `<${tag} data-site-metadata${attrs}>${content}`
  })
  return html.replace(metadataRegion, `<!-- site-metadata:start -->\n    ${tags.join("\n    ")}\n    <!-- site-metadata:end -->`)
}

/** Emit heads for static utility routes without duplicating the application bundle. */
export function siteMetadataPlugin(): Plugin {
  let rootDirectory = ""
  let outputDirectory = ""
  let building = false

  function pageFile(pathname: string) {
    const normalized = pathname.replace(/\/+$/, "") || "/"
    if (normalized === "/") return "index.html"
    if (normalized === "/pricing") return "pricing.html"
    if (Object.prototype.hasOwnProperty.call(utilityPages, normalized)) return `_pages${normalized}.html`
    if (/^\/assignments\/[^/]+$/.test(normalized)) return "_pages/assignment.html"
    return null
  }

  function redirect(pathname: string) {
    if (pathname === "/index.html") return "/"
    if (pathname === "/pricing.html") return "/pricing"
    if (pathname === "/sign-in") return "/login"
    if (pathname !== "/" && pathname.endsWith("/")) return pathname.replace(/\/+$/, "")
    return null
  }

  function isPageRequest(pathname: string, accept: string | undefined) {
    if (pathname.startsWith("/@") || pathname.startsWith("/__vite") || pathname.startsWith("/__open-in-editor")) return false
    if (/^\/(?:api|@[^/]*|src|node_modules|assets|media|fonts|icons|social|img|_pages)\//.test(pathname)) return false
    return Boolean(pageFile(pathname) || pathname.endsWith(".html") || !path.extname(pathname) || accept?.includes("text/html"))
  }

  return {
    name: "site-metadata",
    enforce: "post",
    configResolved(config) {
      rootDirectory = config.root
      outputDirectory = path.resolve(config.root, config.build.outDir)
      building = config.command === "build" && !config.build.ssr
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url || !["GET", "HEAD"].includes(request.method ?? "")) return next()
        const url = new URL(request.url, "http://localhost")
        if (!isPageRequest(url.pathname, request.headers.accept)) return next()
        const destination = redirect(url.pathname)
        if (destination) { response.writeHead(308, { Location: destination + url.search }); response.end(); return }
        try {
          const template = await readFile(path.join(rootDirectory, "index.html"), "utf8")
          const html = await server.transformIndexHtml(request.url, template, request.url)
          response.statusCode = pageFile(url.pathname) ? 200 : 404
          response.setHeader("Content-Type", "text/html; charset=utf-8")
          if (getPageMetadata(url.pathname).robots.startsWith("noindex")) response.setHeader("X-Robots-Tag", "noindex, nofollow")
          response.end(request.method === "HEAD" ? "" : html)
        } catch (error) { next(error) }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url || !["GET", "HEAD"].includes(request.method ?? "")) return next()
        const url = new URL(request.url, "http://localhost")
        if (!isPageRequest(url.pathname, request.headers.accept)) return next()
        const destination = redirect(url.pathname)
        if (destination) { response.writeHead(308, { Location: destination + url.search }); response.end(); return }
        try {
          const file = pageFile(url.pathname)
          const html = await readFile(path.join(outputDirectory, file ?? "404.html"), "utf8")
          response.statusCode = file ? 200 : 404
          response.setHeader("Content-Type", "text/html; charset=utf-8")
          if (getPageMetadata(url.pathname).robots.startsWith("noindex")) response.setHeader("X-Robots-Tag", "noindex, nofollow")
          response.end(request.method === "HEAD" ? "" : html)
        } catch (error) { next(error) }
      })
    },
    transformIndexHtml: {
      order: "post",
      async handler(html, context) {
        const pathname = context.server
          ? new URL(context.originalUrl ?? context.path, "http://localhost").pathname
          : "/"
        const output = renderPageHead(html, pathname)
        if (context.server && (Object.prototype.hasOwnProperty.call(publicPages, pathname) || !pageFile(pathname))) {
          const renderer = await context.server.ssrLoadModule("/src/entry-public.tsx") as { renderPublicPage: (pathname: string) => string }
          return insertPublicContent(output, renderer.renderPublicPage(pathname), pathname)
        }
        return output
      },
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"]
        if (!index || index.type !== "asset" || typeof index.source !== "string") {
          throw new Error("The built index.html is required to emit route metadata.")
        }
        for (const pathname of Object.keys(utilityPages)) {
          this.emitFile({ type: "asset", fileName: `_pages${pathname}.html`, source: renderPageHead(index.source, pathname) })
        }
        this.emitFile({ type: "asset", fileName: "_pages/assignment.html", source: renderPageHead(index.source, "/assignments/private") })
        this.emitFile({ type: "asset", fileName: "pricing.html", source: renderPageHead(index.source, "/pricing") })
        this.emitFile({ type: "asset", fileName: "404.html", source: renderPageHead(index.source, "/__not-found__") })
      },
    },
    closeBundle: {
      order: "pre",
      sequential: true,
      async handler() {
        if (building) await prerenderPublicPages(rootDirectory, outputDirectory)
      },
    },
  }
}
