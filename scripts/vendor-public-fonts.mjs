import { mkdir, writeFile } from "node:fs/promises"

const directory = new URL("../public/fonts/", import.meta.url)
await mkdir(directory, { recursive: true })
const cssResponse = await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:wght@400..900&display=swap", {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
})
if (!cssResponse.ok) throw new Error(`Font CSS download failed: ${cssResponse.status}`)
const css = await cssResponse.text()
for (const { family, name, licenseDirectory } of [
  { family: "Inter", name: "inter-latin", licenseDirectory: "inter" },
  { family: "Playfair Display", name: "playfair-display-latin", licenseDirectory: "playfairdisplay" },
]) {
  const latinBlocks = [...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map((match) => match[1])
  const block = latinBlocks.find((value) => value.includes(`font-family: '${family}'`))
  const fontUrl = block?.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1]
  if (!fontUrl) throw new Error(`Missing Latin variable WOFF2 for ${family}`)
  const font = await fetch(fontUrl)
  if (!font.ok) throw new Error(`Font download failed for ${family}: ${font.status}`)
  await writeFile(new URL(`${name}.woff2`, directory), Buffer.from(await font.arrayBuffer()))
  const license = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${licenseDirectory}/OFL.txt`)
  if (!license.ok) throw new Error(`Font license download failed for ${family}: ${license.status}`)
  await writeFile(new URL(`${name}-OFL.txt`, directory), await license.text())
}
