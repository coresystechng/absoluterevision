import path from "node:path"
import fs from "node:fs"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv, type Plugin } from "vite"

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
        const routeFile = path.resolve(apiRoot, `${routePath}.ts`)

        if (!routeFile.startsWith(apiRoot + path.sep) || !fs.existsSync(routeFile)) {
          next()
          return
        }

        try {
          const routeModule = await server.ssrLoadModule(routeFile)
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
