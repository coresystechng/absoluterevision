import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const output = new URL("../public/media/", import.meta.url)
await mkdir(output, { recursive: true })
const sources = [
  { name: "hero-students", source: "hero-students.jpg", widths: [640, 1280, 1920] },
  { name: "editing-workspace", source: "stx-1.jpg", widths: [480, 800] },
  { name: "editing-notes", source: "slide (1).jpg", widths: [480, 960] },
]
for (const { name, source, widths } of sources) {
  for (const width of widths) {
    await sharp(fileURLToPath(new URL(`../img/${source}`, import.meta.url)))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(fileURLToPath(new URL(`${name}-${width}.webp`, output)))
  }
}
