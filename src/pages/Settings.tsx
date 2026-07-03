import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, UserMinus, UsersRound } from "lucide-react"

import { removeAll } from "@/api/assignments"
import { getOrCreateUser, updateProfile } from "@/api/users"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { Navbar } from "@/components/Navbar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTeams } from "@/hooks/useTeams"
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
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [memberEmail, setMemberEmail] = useState("")
  const {
    teams,
    members,
    isLoading: teamsLoading,
    isMembersLoading,
    reloadTeams,
    createTeam,
    updateTeamName,
    addTeamMember,
    removeTeamMember,
  } = useTeams(user.id, activeTeamId)
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? teams[0] ?? null
  const canManageActiveTeam = activeTeam?.role === "admin"

  useEffect(() => {
    void getOrCreateUser(user)
      .then((profile) => setDisplayName(profile.displayName ?? ""))
      .then(() => reloadTeams())
      .catch(() => toast.error("Something went wrong. Try again."))
  }, [reloadTeams, user])

  useEffect(() => {
    if (teams.length === 0) {
      setActiveTeamId(null)
      setTeamName("")
      return
    }

    const nextActiveTeam = activeTeamId && teams.some((team) => team.id === activeTeamId)
      ? teams.find((team) => team.id === activeTeamId)!
      : teams[0]

    setActiveTeamId(nextActiveTeam.id)
    setTeamName(nextActiveTeam.name)
  }, [activeTeamId, teams])

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
      toast.error("Assignments deleted")
    } catch {
      toast.error("Something went wrong. Try again.")
    }
  }

  const createNewTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const team = await createTeam(newTeamName)
      setNewTeamName("")
      setActiveTeamId(team.id)
      toast.success("Team created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create team.")
    }
  }

  const saveTeamName = async () => {
    if (!activeTeam) {
      return
    }

    try {
      await updateTeamName(activeTeam.id, teamName)
      toast.success("Team updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update team.")
    }
  }

  const addMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeTeam) {
      return
    }

    try {
      await addTeamMember(activeTeam.id, memberEmail)
      setMemberEmail("")
      toast.success("Member added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add member.")
    }
  }

  const removeMember = async (memberUserId: string) => {
    if (!activeTeam) {
      return
    }

    try {
      await removeTeamMember(activeTeam.id, memberUserId)
      toast.success("Member removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove member.")
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

        <Card>
          <CardHeader>
            <CardTitle>Team & members</CardTitle>
            <CardDescription>Admins can create teams, add members, and assign work from the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-2">
                <Label>Current team</Label>
                <Select
                  value={activeTeam ? String(activeTeam.id) : ""}
                  onValueChange={(value) => setActiveTeamId(Number(value))}
                  disabled={teamsLoading || teams.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={teamsLoading ? "Loading teams" : "Select team"} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                <UsersRound className="h-4 w-4" />
                {activeTeam
                  ? `${activeTeam.memberCount} member${activeTeam.memberCount === 1 ? "" : "s"} - ${activeTeam.role === "admin" ? "Admin" : "Member"}`
                  : "No team"}
              </div>
            </div>

            <form className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={createNewTeam}>
              <div className="grid gap-2">
                <Label htmlFor="new-team-name">New team</Label>
                <Input
                  id="new-team-name"
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  placeholder="e.g. July Dissertation Team"
                />
              </div>
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Create team
              </Button>
            </form>

            {activeTeam ? (
              <>
                <div className="grid gap-3 rounded-md border p-3">
                  <div className="grid gap-2">
                    <Label htmlFor="team-name">Team name</Label>
                    <Input
                      id="team-name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      disabled={!canManageActiveTeam}
                    />
                  </div>
                  {canManageActiveTeam ? (
                    <Button className="w-fit" type="button" onClick={() => void saveTeamName()}>
                      Save team
                    </Button>
                  ) : null}
                </div>

                {canManageActiveTeam ? (
                  <form className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={addMember}>
                    <div className="grid gap-2">
                      <Label htmlFor="member-email">Add member by email</Label>
                      <Input
                        id="member-email"
                        type="email"
                        value={memberEmail}
                        onChange={(event) => setMemberEmail(event.target.value)}
                        placeholder="member@example.com"
                      />
                    </div>
                    <Button type="submit">
                      <Plus className="h-4 w-4" />
                      Add member
                    </Button>
                  </form>
                ) : null}

                <div className="grid gap-2">
                  <Label>Members</Label>
                  <div className="grid gap-2">
                    {isMembersLoading ? (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">Loading members...</div>
                    ) : members.length > 0 ? (
                      members.map((member) => (
                        <div
                          key={member.userId}
                          className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{member.displayName || member.email}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {member.email} - {member.role === "admin" ? "Admin" : "Member"}
                            </p>
                          </div>
                          {canManageActiveTeam && member.role !== "admin" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void removeMember(member.userId)}
                            >
                              <UserMinus className="h-4 w-4" />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">No members yet.</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
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
