import { type ChangeEvent, type FormEvent, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import {
  submitDocumentUpload,
  type DocumentUploadResult,
} from "@/api/document-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

import privacyPolicyUrl from "../../assets/privacy.md?url"
import termsUrl from "../../assets/terms.md?url"
import logoImage from "../../img/logo.png"

const acceptedDocumentExtensions = [
  "csv",
  "doc",
  "docx",
  "odt",
  "pages",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
]
const acceptedFileTypes = acceptedDocumentExtensions
  .map((extension) => `.${extension}`)
  .join(",")
const maxUploadBytes = 250 * 1024 * 1024
const supportEmail = "support@absoluterevision.com"
const phoneDisplay = "+1 937 249 0400"
const phoneHref = "tel:+19372490400"

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
  const extensionStart = fileName.lastIndexOf(".")
  if (extensionStart <= 0 || extensionStart === fileName.length - 1) {
    return ""
  }

  return fileName.slice(extensionStart + 1).toLowerCase()
}

function isAcceptedFile(file: File) {
  return acceptedDocumentExtensions.includes(getFileExtension(file.name))
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function DocumentUpload() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<DocumentUploadResult | null>(null)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)

  const selectedFileLabel = file
    ? `${file.name} - ${formatBytes(file.size)}`
    : "No document selected"

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.[0] ?? null
    setUploadResult(null)

    if (!selectedFile) {
      setFile(null)
      return
    }

    if (selectedFile.size > maxUploadBytes) {
      toast.error("Files must be 250 MB or smaller.")
      event.currentTarget.value = ""
      setFile(null)
      return
    }

    if (!isAcceptedFile(selectedFile)) {
      toast.error("Upload a Word, PDF, RTF, OpenDocument, text, presentation, or spreadsheet file.")
      event.currentTarget.value = ""
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  const resetForm = () => {
    setFullName("")
    setEmail("")
    setFile(null)
    setProgress(0)
    setUploadResult(null)
    setIsSuccessDialogOpen(false)
    setFileInputKey((key) => key + 1)
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (trimmedName.length < 2) {
      toast.error("Enter your Full Name.")
      return
    }

    if (!validateEmail(trimmedEmail)) {
      toast.error("Enter a valid Email Address.")
      return
    }

    if (!file) {
      toast.error("Choose a document to upload.")
      return
    }

    setIsUploading(true)
    setProgress(0)
    setUploadResult(null)

    try {
      const result = await submitDocumentUpload({
        fullName: trimmedName,
        email: trimmedEmail,
        file,
        onProgress: setProgress,
      })
      setUploadResult(result)
      setIsSuccessDialogOpen(true)
      setFile(null)
      setFileInputKey((key) => key + 1)
      toast.success("Document submitted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-semibold">
            <img src={logoImage} alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="truncate">Absolute Revision</span>
          </Link>

          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </header>

      <section className="border-b bg-muted/30 px-4 py-10 sm:py-14">
        <div className="mx-auto grid max-w-3xl gap-8">
          <div>
            <Badge variant="secondary" className="w-fit">
              <ShieldCheck className="h-3.5 w-3.5" />
              Confidential upload
            </Badge>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal sm:text-5xl">
              Submit your document for editing.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Send your manuscript directly to the Absolute Revision team. We will review your file and contact you through the email address provided.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-md border bg-background/70 p-4">
                <div className="mt-0.5 rounded-md border bg-card p-2 text-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="leading-6">
                  Word, PDF, RTF, OpenDocument, text, presentation, and spreadsheet files are supported.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-md border bg-background/70 p-4">
                <div className="mt-0.5 rounded-md border bg-card p-2 text-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <p className="leading-6">
                  We use your email address for project follow-up and delivery communication.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Document Upload</CardTitle>
              <CardDescription>
                Complete the fields below and attach your document.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-5" onSubmit={(event) => void onSubmit(event)}>
                <div className="grid gap-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    name="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.currentTarget.value)}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    disabled={isUploading}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email-address">Email Address</Label>
                  <Input
                    id="email-address"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.currentTarget.value)}
                    autoComplete="email"
                    placeholder="Enter your email address"
                    disabled={isUploading}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="document-file">Document</Label>
                  <Input
                    key={fileInputKey}
                    id="document-file"
                    name="document"
                    type="file"
                    accept={acceptedFileTypes}
                    onChange={onFileChange}
                    disabled={isUploading}
                    required
                    className="h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
                  />
                  <p className="text-sm text-muted-foreground">{selectedFileLabel}</p>
                </div>

                {isUploading ? (
                  <div className="grid gap-2" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>Uploading document</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                ) : null}

                <Button type="submit" disabled={isUploading} size="lg">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isUploading ? "Submitting" : "Submit"}
                </Button>
              </form>

              <Separator className="my-6" />

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Maximum file size: {formatBytes(maxUploadBytes)}</span>
                <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={isUploading}>
                  Clear form
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="px-4 py-10">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto_auto] md:items-start">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <img src={logoImage} alt="" className="h-8 w-8 object-contain" />
              <span>Absolute Revision</span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              High-quality editing, proofreading, and formatting services for researchers, authors, students, and businesses.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <a href={phoneHref} className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
              <Phone className="h-4 w-4" />
              {phoneDisplay}
            </a>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
              {supportEmail}
            </a>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground md:justify-end">
            <a href={privacyPolicyUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Privacy Policy
            </a>
            <a href={termsUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Site Terms
            </a>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-6xl border-t pt-6 text-sm text-muted-foreground">
          <p>Copyright 2026 Absolute Revision. All rights reserved.</p>
        </div>
      </footer>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle>Submission received</DialogTitle>
            <DialogDescription>
              Thank you. Your document was submitted successfully, and the Absolute Revision team will follow up by email.
            </DialogDescription>
          </DialogHeader>

          {uploadResult ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Submitted document</p>
              <p className="mt-1 break-words">
                {uploadResult.fileName} - {formatBytes(uploadResult.sizeBytes)}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetForm}>
              Submit another document
            </Button>
            <Button asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
