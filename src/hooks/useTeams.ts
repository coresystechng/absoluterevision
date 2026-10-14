import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as teamsApi from "@/api/teams"
import { isWorkspaceClientCurrent, purgeTeamAssignments, workspaceKeys } from "@/lib/workspace-cache"
import type { UserProfile } from "@/types"

export function useTeams(userId: string | null, selectedTeamId?: number | null) {
  const client = useQueryClient()
  const teams = useQuery({ queryKey: workspaceKeys.teams(userId ?? ""), enabled: Boolean(userId), queryFn: () => teamsApi.getTeams(userId!) })
  const members = useQuery({ queryKey: workspaceKeys.members(userId ?? "", selectedTeamId ?? 0), enabled: Boolean(userId && selectedTeamId && selectedTeamId > 0), queryFn: () => teamsApi.getTeamMembers(userId!, selectedTeamId!) })
  const requireUser = () => { if (!userId) throw new Error("Missing user"); return userId }
  const refreshTeam = async (teamId: number) => {
    const id = requireUser()
    if (!isWorkspaceClientCurrent(client, id)) return
    await purgeTeamAssignments(client, id, [teamId])
    if (!isWorkspaceClientCurrent(client, id)) return
    await Promise.all([
      client.resetQueries({ queryKey: workspaceKeys.teams(id) }),
      client.invalidateQueries({ queryKey: workspaceKeys.members(id, teamId) }),
    ])
  }
  return {
    teams: teams.data ?? [], members: members.data ?? [],
    isLoading: Boolean(userId) && teams.isPending,
    isMembersLoading: Boolean(userId && selectedTeamId) && members.isPending,
    error: teams.error, membersError: members.error,
    reloadTeams: async () => { if (userId) await teams.refetch() },
    reloadMembers: async () => { if (userId && selectedTeamId) await members.refetch() },
    createTeam: async (name: string) => { const id = requireUser(); const result = await teamsApi.createTeam(id, name); if (isWorkspaceClientCurrent(client, id)) await teams.refetch(); return result },
    updateTeamName: async (teamId: number, name: string) => { await teamsApi.updateTeamName(requireUser(), teamId, name); await refreshTeam(teamId) },
    deleteTeam: async (teamId: number) => {
      const id = requireUser()
      const next = await teamsApi.deleteTeam(id, teamId)
      await refreshTeam(teamId)
      if (!isWorkspaceClientCurrent(client, id)) return next
      client.removeQueries({ queryKey: workspaceKeys.members(id, teamId) })
      client.setQueryData<UserProfile>(workspaceKeys.profile(id), (profile) => profile ? { ...profile, activeTeamId: next } : profile)
      return next
    },
    addTeamMember: async (teamId: number, email: string) => { await teamsApi.addTeamMember(requireUser(), teamId, email); await refreshTeam(teamId) },
    removeTeamMember: async (teamId: number, memberUserId: string) => { await teamsApi.removeTeamMember(requireUser(), teamId, memberUserId); await refreshTeam(teamId) },
  }
}
