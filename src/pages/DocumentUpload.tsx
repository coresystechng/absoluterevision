import { PublicFooter } from "@/components/PublicFooter"
import { type ChangeEvent, type FormEvent, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Send,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  submitDocumentUploads,
  requestSubmissionEmailCode,
  verifySubmissionEmailCode,
  type DocumentUploadFailure,
  type DocumentUploadResult,
} from "@/api/document-upload"
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
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_MAX_FILES,
  documentUploadAccept,
  getDocumentUploadSelectionError,
} from "../../shared/document-uploads"

import logoImage from "../../img/icon.png"


function formatBytes(sizeBytes: number) {
  if (sizeBytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(sizeBytes) / Math.log(1024)), units.length - 1)
  const value = sizeBytes / 1024 ** unitIndex
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function DocumentUpload() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [emailProof, setEmailProof] = useState<{ email: string; token: string; expiresAt: number } | null>(null)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState(0)
  const normalizedEmail = email.trim().toLowerCase()
  const hasVerifiedEmail = emailProof?.email === normalizedEmail && emailProof.expiresAt > Date.now()

  const sendCode = async () => {
    if (!validateEmail(email.trim())) { setVerificationError("Enter a valid Email Address."); return }
    if (Date.now() < resendAt) { setVerificationError("Please wait one minute before requesting another code."); return }
    setVerificationBusy(true)
    setVerificationError(null)
    try {
      const result = await requestSubmissionEmailCode(normalizedEmail)
      setChallengeId(result.challengeId)
      setVerificationCode("")
      setEmailProof(null)
      setResendAt(Date.now() + 60_000)
    } catch (error) { setVerificationError(error instanceof Error ? error.message : "Could not send the code.") }
    finally { setVerificationBusy(false) }
  }

  const verifyCode = async () => {
    setVerificationBusy(true)
    setVerificationError(null)
    try {
      const result = await verifySubmissionEmailCode(normalizedEmail, challengeId, verificationCode)
      setEmailProof({ email: normalizedEmail, token: result.verificationToken, expiresAt: Date.now() + result.expiresIn * 1000 })
      setVerificationCode("")
    } catch (error) { setVerificationError(error instanceof Error ? error.message : "Could not verify the code.") }
    finally { setVerificationBusy(false) }
  }

  const [files, setFiles] = useState<File[]>([])
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<DocumentUploadResult[]>([])
  const [uploadFailures, setUploadFailures] = useState<DocumentUploadFailure[]>([])
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const canRetry = files.length > 0 && files.every((file) => uploadFailures.some((failure) => failure.file === file && failure.uploadAccess))

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    if (selectedFiles.length === 0) return
    const error = getDocumentUploadSelectionError(selectedFiles)
    setSelectionError(error)
    if (error) {
      toast.error(error)
      event.currentTarget.value = ""
      return
    }
    setFiles(selectedFiles)
    setUploadResults([])
    setUploadFailures([])
    setProgress(0)
  }

  const resetForm = () => {
    setFullName("")
    setEmail("")
    setEmailProof(null)
    setChallengeId("")
    setVerificationCode("")
    setVerificationError(null)
    setResendAt(0)
    setFiles([])
    setProgress(0)
    setUploadResults([])
    setUploadFailures([])
    setSelectionError(null)
    setIsSuccessDialogOpen(false)
    setFileInputKey((key) => key + 1)
  }

  const removeFile = (file: File, index: number) => {
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
    setUploadFailures((previous) => previous.filter((failure) => failure.file !== file))
    setSelectionError(null)
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

    const error = getDocumentUploadSelectionError(files)
    if (error) {
      setSelectionError(error)
      toast.error(error)
      return
    }

    if (!canRetry && (!emailProof || emailProof.email !== normalizedEmail || emailProof.expiresAt <= Date.now())) {
      setEmailProof(null)
      setVerificationError("Verify your email before submitting files.")
      return
    }
    setIsUploading(true)
    setProgress(0)
    setSelectionError(null)

    try {
      const result = await submitDocumentUploads({
        fullName: trimmedName,
        email: trimmedEmail,
        files,
        retryFailures: uploadFailures,
        verificationToken: emailProof?.token,
        onProgress: setProgress,
      })
      setEmailProof(null)
      setUploadResults((previous) => [...previous, ...result.uploads])
      setUploadFailures(result.failures)
      setFiles(result.failures.map((failure) => failure.file))
      setFileInputKey((key) => key + 1)
      if (result.finalizationError) toast.error(result.finalizationError)
      if (result.failures.length === 0) {
        setIsSuccessDialogOpen(true)
        toast.success(result.uploads.length === 1 ? "File submitted." : "Files submitted.")
      } else {
        toast.error(`${result.uploads.length} of ${files.length} files submitted. Retry the remaining files.`)
      }
    } catch (error) {
      setEmailProof(null)
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main id="top" className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-surface-raised">
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
            <h1 className="mt-5 text-3xl font-semibold tracking-normal sm:text-5xl">
              Submit your files for editing.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Upload up to three documents or images. We will review your files and contact you through the email address provided.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-md border bg-background/70 p-4">
                <div className="mt-0.5 rounded-md border bg-card p-2 text-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="leading-6">
                  Word, PDF, RTF, OpenDocument, text, presentations, spreadsheets, and images are supported.
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
                Complete the fields below and attach up to three files.
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
                    disabled={isUploading || verificationBusy || uploadFailures.some((failure) => failure.uploadAccess)}
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
                    onChange={(event) => { setEmail(event.currentTarget.value); setChallengeId(""); setEmailProof(null); setVerificationError(null) }}
                    autoComplete="email"
                    placeholder="Enter your email address"
                    disabled={isUploading || uploadFailures.some((failure) => failure.uploadAccess)}
                    required
                  />
                </div>

                <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Verify your email to upload files. No account or password is required.</p>
                  {hasVerifiedEmail || canRetry ? <p role="status" className="text-sm font-medium">Email verified</p> : (
                    <>
                      <Button type="button" variant="outline" onClick={() => void sendCode()} disabled={verificationBusy || isUploading} className="w-fit">
                        {verificationBusy ? "Please wait…" : challengeId ? "Resend code" : "Send verification code"}
                      </Button>
                      {challengeId ? (
                        <div className="grid gap-3">
                          <p role="status" className="text-sm text-muted-foreground">Check your email for a code. It expires in 10 minutes.</p>
                          <Label htmlFor="verification-code">Verification code</Label>
                          <Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verificationCode}
                            onChange={(event) => setVerificationCode(event.currentTarget.value.replace(/\D/g, ""))} disabled={verificationBusy || isUploading} placeholder="Six-digit code" />
                          <Button type="button" onClick={() => void verifyCode()} disabled={verificationBusy || verificationCode.length !== 6 || isUploading} className="w-fit">Verify email</Button>
                        </div>
                      ) : null}
                    </>
                  )}
                  {verificationError ? <p role="alert" className="text-sm text-destructive">{verificationError}</p> : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="document-file">Documents or images</Label>
                  <Input
                    key={fileInputKey}
                    id="document-file"
                    name="files"
                    type="file"
                    accept={documentUploadAccept}
                    multiple
                    onChange={onFileChange}
                    disabled={isUploading}
                    required={files.length === 0}
                    aria-describedby="file-upload-help"
                    aria-invalid={Boolean(selectionError)}
                    aria-errormessage={selectionError ? "file-upload-error" : undefined}
                    className="h-auto cursor-pointer py-2 file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
                  />
                  <p id="file-upload-help" className="text-sm text-muted-foreground">
                    Choose up to {DOCUMENT_UPLOAD_MAX_FILES} files, {formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)} each.
                    Images: JPG, PNG, GIF, WebP, AVIF, BMP, TIFF, and HEIC/HEIF.
                  </p>
                  {selectionError ? (
                    <p id="file-upload-error" role="alert" className="text-sm text-destructive">
                      {selectionError}
                    </p>
                  ) : null}
                  {files.length > 0 ? (
                    <ul aria-label="Selected files" className="grid gap-2">
                      {files.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                          <span className="min-w-0 break-words">{file.name} - {formatBytes(file.size)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isUploading}
                            aria-label={`Remove ${file.name}`}
                            onClick={() => removeFile(file, index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No files selected</p>}
                </div>

                {uploadFailures.length > 0 ? (
                  <div role="alert" className="grid gap-2 rounded-md border p-3 text-sm">
                    <p>{uploadResults.length} files submitted successfully. Submit again to retry only the remaining files.</p>
                    <ul className="grid gap-1">
                      {uploadFailures.map(({ file, message }, index) => (
                        <li key={index} className="break-words text-destructive">{file.name}: {message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {isUploading ? (
                  <div className="grid gap-2" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>Uploading {files.length === 1 ? "file" : `${files.length} files`}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                ) : null}

                <Button type="submit" disabled={isUploading || verificationBusy || files.length === 0 || (!hasVerifiedEmail && !canRetry)} size="lg">
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
                <span>Maximum: {DOCUMENT_UPLOAD_MAX_FILES} files, {formatBytes(DOCUMENT_UPLOAD_MAX_BYTES)} per file</span>
                <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={isUploading}>
                  Clear form
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="mx-auto max-w-6xl px-4 pb-8 text-sm text-muted-foreground">Submissions that are not converted to assignments expire after 14 days and are removed with their files during scheduled cleanup.</p>
      <PublicFooter />

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md border border-success-border bg-success-background text-success-foreground">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle>Submission received</DialogTitle>
            <DialogDescription>
              Thank you. Your {uploadResults.length === 1 ? "file was" : "files were"} submitted successfully, and the Absolute Revision team will follow up by email.
            </DialogDescription>
          </DialogHeader>

          {uploadResults.length > 0 ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Submitted files</p>
              <ul className="mt-1 grid gap-1">
                {uploadResults.map((result, index) => (
                  <li key={index} className="break-words">{result.fileName} - {formatBytes(result.sizeBytes)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetForm}>
              Submit more files
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
