import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type { Plugin, ResolvedConfig } from "vite"

// Build diagnostics stay in ignored local metadata, outside the shipped bundle.
export function bundleAnalysisPlugin(): Plugin {
  let config: ResolvedConfig
  return {
    name: "workspace-bundle-analysis",
    apply: "build",
    configResolved(value) { config = value },
    async generateBundle(_options, bundle) {
      if (config.build.ssr) return
      const chunks: Record<string, string[]> = {}
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue
        chunks[output.fileName] = output.moduleIds.map((id) => path.relative(config.root, id).replaceAll("\\", "/"))
      }
      const directory = path.resolve(config.root, "node_modules/.cache/absolute-revision-bundle-analysis")
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, "modules.json"), JSON.stringify({ outputDirectory: path.resolve(config.root, config.build.outDir), chunks }), "utf8")
    },
  }
}
