import { describe, expect, it } from "vitest"

import {
  normalizeAssignmentFileCategory,
  normalizeFileName,
  slugifyFolderSegment,
} from "./files.js"

describe("assignment file helpers", () => {
  it("replaces reserved and control characters in file names", () => {
    expect(normalizeFileName(' report<draft>:"/\\|?*\u0000.pdf ')).toBe(
      "report_draft_________.pdf",
    )
  })

  it("bounds and normalizes folder segments", () => {
    expect(slugifyFolderSegment("  Team / Spring 2026  ")).toBe("team-spring-2026")
    expect(slugifyFolderSegment("A".repeat(100))).toHaveLength(72)
  })

  it("maps invalid categories to other", () => {
    expect(normalizeAssignmentFileCategory("brief")).toBe("brief")
    expect(normalizeAssignmentFileCategory("private")).toBe("other")
    expect(normalizeAssignmentFileCategory(null)).toBe("other")
  })
})
