import { describe, expect, it } from "vitest"
import { editingPrices, formatDollarPrice, formatNaira } from "./public-pricing"

describe("published editing prices", () => {
  it("preserves the approved naira fees and rounded dollar prices", () => {
    expect(editingPrices.map((price) => price.naira)).toEqual([50000, 150000, 200000])
    expect(editingPrices.map((price) => formatDollarPrice(price.dollars))).toEqual(["$40", "$113", "$150"])
    expect(formatNaira(50000)).toContain("50,000")
  })
})
