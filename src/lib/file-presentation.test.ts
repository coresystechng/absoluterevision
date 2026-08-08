import { describe, expect, it } from "vitest"
import { getFilePresentation } from "@/lib/file-presentation"

describe("file presentation", () => {
  it.each([
    ["paper.pdf", "application/pdf", "pdf", "danger"],
    ["draft.docx", "application/octet-stream", "word", "info"],
    ["slides.pptx", "application/octet-stream", "presentation", "warning"],
    ["data.xlsx", "application/octet-stream", "spreadsheet", "success"],
    ["scan.png", "image/png", "image", "info"],
    ["bundle.zip", "application/zip", "archive", "neutral"],
    ["notes.txt", "text/plain", "text", "neutral"],
    ["README", "application/octet-stream", "unknown", "neutral"],
  ] as const)("maps %s to %s", (name, mimeType, kind, tone) => {
    expect(getFilePresentation({ name, mimeType })).toMatchObject({ kind, tone })
  })
})
