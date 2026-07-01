import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { removeAll } from "@/api/assignments"
import { getOrCreateUser, updateProfile } from "@/api/users"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Navbar } from "@/components/Navbar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AuthUser } from "@/types"

export function Settings({
  user,
  onSignOut,
}: {
  user: AuthUser
  onSignOut: () => void | Promise<void>
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void getOrCreateUser(user)
      .then((profile) => setDisplayName(profile.displayName ?? ""))
      .catch(() => toast.error("Something went wrong. Try again."))
  }, [user])

  const saveProfile = async () => {
    setIsSaving(true)
    try {
      await updateProfile(user.id, displayName)
      toast.success("Profile saved")
    } catch {
      toast.error("Something went wrong. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteAssignments = async () => {
    try {
      await removeAll(user.id)
      toast.error("Assignment deleted")
    } catch {
      toast.error("Something went wrong. Try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onSignOut={onSignOut} />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile and workspace preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your display name is stored with your Absolute Revision profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountId">Account ID</Label>
              <Input id="accountId" value={user.id} readOnly />
            </div>
            <Button className="w-fit" onClick={() => void saveProfile()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Choose how the app appears on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>Delete all assignments without deleting your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDialog
              title="Delete all assignments?"
              description="This removes every assignment in your workspace. Your account will remain active."
              confirmLabel="Delete all"
              onConfirm={deleteAssignments}
            >
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Delete all assignments
              </Button>
            </ConfirmDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
