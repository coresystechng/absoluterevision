import { describe, expect, it } from "vitest"

import {
  canDownloadAssignmentFile,
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

  it("only allows admins and the assignee to download assignment files", () => {
    expect(
      canDownloadAssignmentFile({
        userId: "admin-user",
        assigneeUserId: "assigned-user",
        role: "admin",
      }),
    ).toBe(true)
    expect(
      canDownloadAssignmentFile({
        userId: "assigned-user",
        assigneeUserId: "assigned-user",
        role: "member",
      }),
    ).toBe(true)
    expect(
      canDownloadAssignmentFile({
        userId: "other-member",
        assigneeUserId: "assigned-user",
        role: "member",
      }),
    ).toBe(false)
  })
})
