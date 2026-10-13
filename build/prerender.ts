import path from "node:path"
import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import react from "@vitejs/plugin-react"
import { build } from "vite"

export function insertPublicContent(html: string, content: string, pathname: string) {
  const root = '<div id="root"></div>'
  if (!html.includes(root)) throw new Error("Cannot prerender: the empty root element is missing.")
  const marker = pathname === "/" || pathname === "/pricing" ? pathname : "not-found"
  return html.replace(root, `<div id="root" data-prerendered="${marker}">${content}</div>`)
}

/** Finish static rendering before Workbox hashes the HTML for its precache. */
export async function prerenderPublicPages(root: string, outputDirectory: string) {
  const temporaryDirectory = path.resolve(root, "node_modules/.cache/absolute-revision-prerender")
  await build({
    configFile: false,
    root,
    envDir: false,
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(root, "src") } },
    build: {
      ssr: path.resolve(root, "src/entry-public.tsx"),
      outDir: temporaryDirectory,
      emptyOutDir: true,
      rolldownOptions: { output: { entryFileNames: "render.mjs", chunkFileNames: "assets/[name]-[hash].mjs" } },
    },
  })
  const renderer = await import(`${pathToFileURL(path.join(temporaryDirectory, "render.mjs")).href}?build=${Date.now()}`) as { renderPublicPage: (pathname: string) => string }
  for (const [pathname, file] of [["/", "index.html"], ["/pricing", "pricing.html"], ["/__not-found__", "404.html"]]) {
    const filename = path.join(outputDirectory, file)
    const html = await readFile(filename, "utf8")
    await writeFile(filename, insertPublicContent(html, renderer.renderPublicPage(pathname), pathname))
  }
}

/** Follow static ESM imports only; lazy workspace chunks are cached on demand. */
export async function getPublicScriptDependencies(outputDirectory: string) {
  const html = await readFile(path.join(outputDirectory, "index.html"), "utf8")
  const entry = html.match(/<script\b[^>]*src="\/([^"\s]+\.js)"/)?.[1]
  if (!entry) throw new Error("The public entry script is missing from the built HTML.")
  const dependencies = new Set<string>()
  async function visit(url: string) {
    if (dependencies.has(url)) return
    if (!url.startsWith("assets/")) throw new Error("A public script import escaped the assets directory.")
    dependencies.add(url)
    const source = await readFile(path.join(outputDirectory, url), "utf8")
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.\/[^"']+\.js)["']/g)) {
      await visit(path.posix.join(path.posix.dirname(url), match[1]))
    }
  }
  await visit(entry)
  return dependencies
}
