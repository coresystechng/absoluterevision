import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

// Run with `node scripts/generate-social-image.mjs` after editing the SVG.
const source = await readFile(new URL("../public/social/absolute-revision.svg", import.meta.url), "utf8")
const browser = await chromium.launch(process.platform === "win32" ? { channel: "msedge" } : {})
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(`<html><head><style>html,body{margin:0;width:1200px;height:630px}svg{display:block}</style></head><body>${source}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: fileURLToPath(new URL("../public/social/absolute-revision.png", import.meta.url)) })
} finally {
  await browser.close()
}
