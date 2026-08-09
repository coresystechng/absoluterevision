import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRef, useState } from "react"

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel?: string
  pendingLabel?: string
  errorDescription?: string
  children: React.ReactNode
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting...",
  errorDescription = "The action could not be completed. Try again.",
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const pendingRef = useRef(false)

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault()
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError(false)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      setError(true)
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pendingRef.current) { setOpen(next); if (next) setError(false) } }}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault() }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-danger-foreground">{errorDescription}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(event) => void confirm(event)}>{pending ? pendingLabel : confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
