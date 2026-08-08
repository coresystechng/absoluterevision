import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8")

function themeTokens(selector: ":root" | ".dark") {
  const escapedSelector = selector.replace(".", "\\.")
  const block = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
  if (!block) throw new Error(`Missing ${selector} theme block`)

  return new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
}

function rgb(hex: string) {
  const value = hex.replace("#", "")
  if (!/^[\da-f]{6}$/i.test(value)) throw new Error(`Expected six-digit hex, received ${hex}`)
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
}

function luminance(hex: string) {
  const [red, green, blue] = rgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

const themes = {
  light: themeTokens(":root"),
  dark: themeTokens(".dark"),
}

function token(theme: keyof typeof themes, name: string) {
  const value = themes[theme].get(name)
  if (!value) throw new Error(`Missing --${name} in ${theme} theme`)
  return value
}

describe("theme token contrast", () => {
  it("keeps the light and dark token contracts in sync", () => {
    const themeContract = (values: Map<string, string>) => [...values.keys()].filter((name) => name !== "radius").sort()
    expect(themeContract(themes.dark)).toEqual(themeContract(themes.light))
  })

  describe.each(["light", "dark"] as const)("%s theme", (theme) => {
    it("keeps primary and muted copy legible on canvas and cards", () => {
      for (const surface of ["background", "card"]) {
        expect(contrast(token(theme, "foreground"), token(theme, surface))).toBeGreaterThanOrEqual(4.5)
        expect(contrast(token(theme, "muted-foreground"), token(theme, surface))).toBeGreaterThanOrEqual(4.5)
      }
    })

    it("keeps control boundaries and focus rings distinguishable", () => {
      expect(contrast(token(theme, "input"), token(theme, "surface-inset"))).toBeGreaterThanOrEqual(3)
      expect(contrast(token(theme, "ring"), token(theme, "background"))).toBeGreaterThanOrEqual(3)
      expect(contrast(token(theme, "ring"), token(theme, "card"))).toBeGreaterThanOrEqual(3)
    })

    it("keeps raised cards visibly separate from the canvas", () => {
      expect(token(theme, "surface-raised")).toBe(token(theme, "card"))
      expect(contrast(token(theme, "card"), token(theme, "background"))).toBeGreaterThanOrEqual(1.18)
    })
  })
})
