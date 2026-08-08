import type { SemanticTone } from "@/lib/assignment-presentation"

export type FilePresentationKind = "pdf" | "word" | "presentation" | "spreadsheet" | "image" | "archive" | "text" | "unknown"

export type FilePresentation = { kind: FilePresentationKind; label: string; tone: SemanticTone }

function extensionOf(name: string) {
  const normalized = name.trim().toLowerCase()
  const index = normalized.lastIndexOf(".")
  return index > 0 && index < normalized.length - 1 ? normalized.slice(index + 1) : ""
}

export function getFilePresentation(file: { name: string; mimeType: string }): FilePresentation {
  const extension = extensionOf(file.name)
  const label = extension ? extension.toUpperCase() : "FILE"
  if (extension === "pdf" || file.mimeType.includes("pdf")) return { kind: "pdf", label: extension ? label : "PDF", tone: "danger" }
  if (["doc", "docx", "odt", "rtf"].includes(extension) || file.mimeType.includes("word") || file.mimeType.includes("document")) return { kind: "word", label, tone: "info" }
  if (["ppt", "pptx"].includes(extension) || file.mimeType.includes("presentation")) return { kind: "presentation", label, tone: "warning" }
  if (["xls", "xlsx", "csv"].includes(extension) || file.mimeType.includes("spreadsheet") || file.mimeType.includes("csv")) return { kind: "spreadsheet", label, tone: "success" }
  if (file.mimeType.startsWith("image/")) return { kind: "image", label: extension ? label : "IMAGE", tone: "info" }
  if (["zip", "rar", "tar", "7z"].includes(extension) || /zip|rar|tar/.test(file.mimeType)) return { kind: "archive", label: extension ? label : "ARCHIVE", tone: "neutral" }
  if (["txt", "md"].includes(extension) || file.mimeType.startsWith("text/")) return { kind: "text", label: extension ? label : "TEXT", tone: "neutral" }
  return { kind: "unknown", label, tone: "neutral" }
}
