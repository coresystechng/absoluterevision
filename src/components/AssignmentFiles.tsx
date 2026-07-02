import { format, parseISO } from "date-fns"
import {
  ExternalLink,
  File,
  FileArchive,
  FileBadge,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderSync,
  Loader2,
  Presentation,
  Trash2,
  Upload,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import {
  getAssignmentFileDownloadUrl,
  getAssignmentFiles,
  getDropboxAuthUrl,
  getDropboxStatus,
  removeAssignmentFile,
  uploadAssignmentFile,
} from "@/api/assignment-files"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  assignmentFileCategories,
  getAssignmentFileCategoryLabel,
} from "@/lib/assignment-files"
import { cn } from "@/lib/utils"
import type { AssignmentFile, AssignmentFileCategory, AuthUser } from "@/types"

type AssignmentFilesProps = {
  assignmentId: number
  user: AuthUser
  actorName: string
  onActivityChange: () => void | Promise<void>
}

type DropboxStatus = {
  isConfigured: boolean
  isConnected: boolean
}

type FileVisual = {
  icon: LucideIcon
  label: string
  iconClassName: string
  badgeClassName: string
}

const ownerUserId = import.meta.env.VITE_DROPBOX_OWNER_USER_ID as string | undefined

const defaultFileVisual: FileVisual = {
  icon: File,
  label: "FILE",
  iconClassName: "text-muted-foreground",
  badgeClassName: "border-border bg-muted text-muted-foreground",
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(sizeBytes) / Math.log(1024)), units.length - 1)
  const value = sizeBytes / 1024 ** unitIndex
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase()
  const extensionStart = normalizedName.lastIndexOf(".")

  if (extensionStart <= 0 || extensionStart === normalizedName.length - 1) {
    return ""
  }

  return normalizedName.slice(extensionStart + 1)
}

function getFileVisual(file: AssignmentFile): FileVisual {
  const extension = getFileExtension(file.name)

  if (extension === "pdf") {
    return {
      icon: FileBadge,
      label: "PDF",
      iconClassName: "text-red-600",
      badgeClassName: "border-red-200 bg-red-50 text-red-700",
    }
  }

  if (extension === "doc" || extension === "docx") {
    return {
      icon: FileText,
      label: extension.toUpperCase(),
      iconClassName: "text-blue-600",
      badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }

  if (extension === "ppt" || extension === "pptx") {
    return {
      icon: Presentation,
      label: extension.toUpperCase(),
      iconClassName: "text-orange-600",
      badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    }
  }

  if (extension === "xls" || extension === "xlsx" || extension === "csv") {
    return {
      icon: FileSpreadsheet,
      label: extension.toUpperCase(),
      iconClassName: "text-emerald-600",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }

  if (file.mimeType.startsWith("image/")) {
    return {
      icon: FileImage,
      label: extension ? extension.toUpperCase() : "IMAGE",
      iconClassName: "text-sky-600",
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    }
  }

  if (
    file.mimeType.includes("zip") ||
    file.mimeType.includes("rar") ||
    file.mimeType.includes("tar")
  ) {
    return {
      icon: FileArchive,
      label: extension ? extension.toUpperCase() : "ARCHIVE",
      iconClassName: "text-violet-600",
      badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    }
  }

  if (
    file.mimeType.includes("pdf") ||
    file.mimeType.includes("document") ||
    file.mimeType.includes("text")
  ) {
    return {
      icon: FileText,
      label: extension ? extension.toUpperCase() : "TEXT",
      iconClassName: "text-blue-600",
      badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    }
  }

  return extension
    ? {
        ...defaultFileVisual,
        label: extension.toUpperCase(),
      }
    : defaultFileVisual
}

function groupFilesByCategory(files: AssignmentFile[]) {
  return assignmentFileCategories.map((category) => ({
    ...category,
    files: files.filter((file) => file.category === category.value),
  }))
}

export function AssignmentFiles({
  assignmentId,
  user,
  actorName,
  onActivityChange,
}: AssignmentFilesProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<DropboxStatus | null>(null)
  const [files, setFiles] = useState<AssignmentFile[]>([])
  const [category, setCategory] = useState<AssignmentFileCategory>("brief")
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState<string | null>(null)
  const isOwner = ownerUserId ? user.id === ownerUserId : false

  const loadFiles = useCallback(async () => {
    if (!isOwner) {
      setStatus({ isConfigured: Boolean(ownerUserId), isConnected: false })
      setFiles([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const dropboxStatus = await getDropboxStatus(user.id)
      setStatus(dropboxStatus)
      if (dropboxStatus.isConnected) {
        setFiles(await getAssignmentFiles(user.id, assignmentId))
      } else {
        setFiles([])
      }
    } catch (error) {
      setFiles([])
      toast.error(error instanceof Error ? error.message : "Could not load assignment files.")
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, isOwner, user.id])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const groupedFiles = useMemo(() => groupFilesByCategory(files), [files])
  const hasFiles = files.length > 0

  const connectDropbox = async () => {
    if (!isOwner) {
      return
    }

    setIsConnecting(true)
    try {
      const { url } = await getDropboxAuthUrl(
        user.id,
        `/assignments/${assignmentId}`,
      )
      window.location.assign(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start Dropbox setup.")
      setIsConnecting(false)
    }
  }

  const handleUpload = async (selectedFiles: FileList | null) => {
    const queue = Array.from(selectedFiles ?? [])
    if (queue.length === 0 || !status?.isConnected) {
      return
    }

    setIsUploading(true)
    try {
      for (const [index, file] of queue.entries()) {
        setUploadLabel(`Uploading ${index + 1} of ${queue.length}: ${file.name}`)
        await uploadAssignmentFile(user.id, {
          assignmentId,
          actorName,
          file,
          category,
        })
      }
      toast.success(queue.length === 1 ? "File uploaded" : "Files uploaded")
      await loadFiles()
      await onActivityChange()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
      setUploadLabel(null)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  const deleteFile = async (file: AssignmentFile) => {
    try {
      await removeAssignmentFile(user.id, actorName, file.id)
      toast.success("File removed")
      await loadFiles()
      await onActivityChange()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove file.")
    }
  }

  const downloadFile = async (file: AssignmentFile) => {
    try {
      const { url } = await getAssignmentFileDownloadUrl(user.id, file.id)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create download link.")
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Files</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Store assignment materials in your Dropbox.
          </p>
        </div>
        {status?.isConnected ? (
          <Badge variant="secondary" className="w-fit">
            <FolderSync className="h-3.5 w-3.5" />
            Dropbox connected
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-5">
        {isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-11" />
            <Skeleton className="h-24" />
          </div>
        ) : !ownerUserId ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Set <span className="font-medium text-foreground">VITE_DROPBOX_OWNER_USER_ID</span>{" "}
            and matching server Dropbox credentials to enable uploads.
          </div>
        ) : !isOwner ? (
          <div className="grid gap-2 rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>The signed-in account is not configured as the Dropbox owner.</p>
            <p>
              Current account ID:{" "}
              <span className="break-all font-mono text-foreground">{user.id}</span>
            </p>
            <p>
              Configured owner ID:{" "}
              <span className="break-all font-mono text-foreground">{ownerUserId}</span>
            </p>
            <p>
              Copy the current account ID into <span className="font-medium text-foreground">VITE_DROPBOX_OWNER_USER_ID</span>{" "}
              and <span className="font-medium text-foreground">DROPBOX_OWNER_USER_ID</span>, then restart the dev server.
            </p>
          </div>
        ) : !status?.isConfigured ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Dropbox credentials are not configured on the server.
          </div>
        ) : !status.isConnected ? (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Connect your Dropbox</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Files uploaded here will be organized inside an Absolute Revision folder.
              </p>
            </div>
            <Button onClick={connectDropbox} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderSync className="h-4 w-4" />
              )}
              Connect Dropbox
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-2">
                <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  File Category
                </span>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as AssignmentFileCategory)}
                >
                  <SelectTrigger aria-label="Choose file category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentFileCategories.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => void handleUpload(event.currentTarget.files)}
              />
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="sm:w-auto"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload
              </Button>
            </div>

            {uploadLabel ? (
              <p className="text-sm text-muted-foreground">{uploadLabel}</p>
            ) : null}

            {!hasFiles ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No files have been uploaded for this assignment yet.
              </div>
            ) : (
              <div className="grid gap-5">
                {groupedFiles.map((group) =>
                  group.files.length > 0 ? (
                    <div key={group.value} className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-medium">
                          {getAssignmentFileCategoryLabel(group.value)}
                        </h3>
                        <Badge variant="outline">{group.files.length}</Badge>
                      </div>
                      <div className="grid gap-2">
                        {group.files.map((file) => {
                          const fileVisual = getFileVisual(file)
                          const FileIcon = fileVisual.icon
                          return (
                            <div
                              key={file.id}
                              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="mt-0.5 rounded-md border bg-muted p-2">
                                  <FileIcon className={cn("h-4 w-4", fileVisual.iconClassName)} />
                                </div>
                                <div className="min-w-0">
                                  <p className="break-words font-medium leading-6">{file.name}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "h-5 rounded px-1.5 py-0 text-[10px] font-semibold tracking-normal",
                                        fileVisual.badgeClassName,
                                      )}
                                    >
                                      {fileVisual.label}
                                    </Badge>
                                    <span>
                                      {formatBytes(file.sizeBytes)} - Uploaded{" "}
                                      {format(parseISO(file.createdAt), "MMM d, yyyy h:mm a")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void downloadFile(file)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Download
                                </Button>
                                <ConfirmDialog
                                  title="Remove file?"
                                  description="This removes the file from Dropbox and the assignment."
                                  confirmLabel="Remove"
                                  onConfirm={() => deleteFile(file)}
                                >
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                    Remove
                                  </Button>
                                </ConfirmDialog>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <Separator />
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
