import path from "node:path"
import fs from "node:fs"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv, type Plugin } from "vite"

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
    plugins: [localApiRoutes(), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
