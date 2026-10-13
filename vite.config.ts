import path from "node:path"
import fs from "node:fs"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { siteMetadataPlugin } from "./build/site-metadata"
import { getPublicScriptDependencies } from "./build/prerender"

type LocalApiRoute = {
  file: string
  params: Record<string, string>
}

function getDynamicRouteParam(entryName: string) {
  return /^\[([^\].]+)\](?:\.ts)?$/.exec(entryName)?.[1] ?? null
}

function findDynamicRouteEntry(directory: string, type: "directory" | "file") {
  if (!fs.existsSync(directory)) {
    return null
  }

  return fs.readdirSync(directory, { withFileTypes: true }).find((entry) => {
    const isExpectedType = type === "directory" ? entry.isDirectory() : entry.isFile()
    return isExpectedType && Boolean(getDynamicRouteParam(entry.name))
  })
}

function appendQueryParam(
  query: Record<string, string | string[]>,
  key: string,
  value: string,
) {
  const existing = query[key]
  if (Array.isArray(existing)) {
    existing.push(value)
  } else if (existing) {
    query[key] = [existing, value]
  } else {
    query[key] = value
  }
}

function resolveLocalApiRoute(apiRoot: string, routePath: string): LocalApiRoute | null {
  const exactRouteFile = path.resolve(apiRoot, `${routePath}.ts`)
  if (exactRouteFile.startsWith(apiRoot + path.sep) && fs.existsSync(exactRouteFile)) {
    return { file: exactRouteFile, params: {} }
  }

  const segments = routePath.split("/").filter(Boolean)
  let currentDir = apiRoot
  const params: Record<string, string> = {}

  for (const [index, segment] of segments.entries()) {
    const isLastSegment = index === segments.length - 1

    if (isLastSegment) {
      const routeFile = path.resolve(currentDir, `${segment}.ts`)
      if (routeFile.startsWith(apiRoot + path.sep) && fs.existsSync(routeFile)) {
        return { file: routeFile, params }
      }

      const dynamicFile = findDynamicRouteEntry(currentDir, "file")
      if (!dynamicFile) {
        return null
      }

      const paramName = getDynamicRouteParam(dynamicFile.name)
      if (!paramName) {
        return null
      }

      params[paramName] = segment
      return { file: path.resolve(currentDir, dynamicFile.name), params }
    }

    const nextDir = path.resolve(currentDir, segment)
    if (nextDir.startsWith(apiRoot + path.sep) && fs.existsSync(nextDir) && fs.statSync(nextDir).isDirectory()) {
      currentDir = nextDir
      continue
    }

    const dynamicDir = findDynamicRouteEntry(currentDir, "directory")
    const paramName = dynamicDir ? getDynamicRouteParam(dynamicDir.name) : null
    if (!dynamicDir || !paramName) {
      return null
    }

    params[paramName] = segment
    currentDir = path.resolve(currentDir, dynamicDir.name)
  }

  return null
}

function localApiRoutes(): Plugin {
  return {
    name: "local-api-routes",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) {
          next()
          return
        }

        const requestUrl = new URL(req.url, "http://localhost")
        const routePath = requestUrl.pathname.replace(/^\/api\/?/, "")
        const apiRoot = path.resolve(__dirname, "api")
        const route = resolveLocalApiRoute(apiRoot, routePath)

        if (!route) {
          next()
          return
        }

        try {
          const routeModule = await server.ssrLoadModule(route.file)
          const handler = routeModule.default

          if (typeof handler !== "function") {
            next()
            return
          }

          const query: Record<string, string | string[]> = {}
          requestUrl.searchParams.forEach((value, key) => {
            const existing = query[key]
            if (Array.isArray(existing)) {
              existing.push(value)
            } else if (existing) {
              query[key] = [existing, value]
            } else {
              query[key] = value
            }
          })

          for (const [key, value] of Object.entries(route.params)) {
            appendQueryParam(query, key, value)
          }

          Object.assign(req, { query })
          Object.assign(res, {
            status(statusCode: number) {
              res.statusCode = statusCode
              return res
            },
            json(body: unknown) {
              if (!res.headersSent) {
                res.setHeader("content-type", "application/json; charset=utf-8")
              }
              res.end(JSON.stringify(body))
            },
          })

          await handler(req, res)
        } catch (error) {
          server.ssrFixStacktrace(error as Error)
          console.error(error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader("content-type", "application/json; charset=utf-8")
            res.end(JSON.stringify({ error: "Local API route failed." }))
          }
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value
  }

  return {
    appType: "mpa",
    plugins: [
      localApiRoutes(),
      react(),
      tailwindcss(),
      siteMetadataPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/apple-touch-icon.png"],
        manifest: {
          name: "Absolute Revision",
          short_name: "Absolute Revision",
          description:
            "Track assignments, deadlines, priorities, and progress in one focused workspace.",
          theme_color: "#101713",
          background_color: "#101713",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "/icons/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/pwa-maskable-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          navigateFallbackAllowlist: [/^\/$/, /^\/(?:pricing|login|sign-in|sign-up|document-upload|track-assignment|dashboard|client-submissions|settings)\/?$/, /^\/assignments\/[^/]+\/?$/],
          cleanupOutdatedCaches: true,
          // Do not undo route splitting by downloading every private chunk when
          // a visitor installs the homepage's service worker.
          manifestTransforms: [async (entries) => {
            const publicScripts = await getPublicScriptDependencies(path.resolve(__dirname, "dist"))
            // Workbox rejects non-2xx precache responses. The error document is
            // served with 404 locally and is never a navigation fallback.
            return { manifest: entries.filter((entry) => entry.url !== "404.html" && (!entry.url.endsWith(".js") || entry.url === "registerSW.js" || publicScripts.has(entry.url))), warnings: [] }
          }],
          runtimeCaching: [{
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"),
            handler: "CacheFirst",
            options: { cacheName: "application-chunks", expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [200] } },
          }],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
