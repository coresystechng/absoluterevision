export const DOCUMENT_UPLOAD_MAX_FILES = 3
export const DOCUMENT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024

export const documentUploadExtensions = [
  "csv", "doc", "docx", "odt", "pages", "pdf", "ppt", "pptx", "rtf", "txt", "xls", "xlsx",
  "avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp",
] as const

export const documentUploadAccept = documentUploadExtensions
  .map((extension) => `.${extension}`)
  .join(",")

export const documentUploadTypeError =
  "Upload a document, presentation, spreadsheet, or supported image (JPG, PNG, GIF, WebP, AVIF, BMP, TIFF, or HEIC)."

type UploadFile = { name: string; size: number }

export function getDocumentUploadFileError(file: UploadFile): string | null {
  const extensionStart = file.name.lastIndexOf(".")
  const extension = extensionStart > 0 ? file.name.slice(extensionStart + 1).toLowerCase() : ""
  if (!documentUploadExtensions.some((allowed) => allowed === extension)) {
    return documentUploadTypeError
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    return "Each file must be between 1 byte and 25 MB."
  }
  return null
}

export function getDocumentUploadSelectionError(files: readonly UploadFile[]): string | null {
  if (files.length === 0) return "Choose at least one file to upload."
  if (files.length > DOCUMENT_UPLOAD_MAX_FILES) return "Choose up to 3 files at a time."
  for (const file of files) {
    const error = getDocumentUploadFileError(file)
    if (error) return `${file.name}: ${error}`
  }
  return null
}
