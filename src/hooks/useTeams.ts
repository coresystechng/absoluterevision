import { useCallback, useEffect, useMemo, useState } from "react"

import * as teamsApi from "@/api/teams"
import type { Team, TeamMember } from "@/types"

export function useTeams(userId: string | null, selectedTeamId?: number | null) {
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMembersLoading, setIsMembersLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reloadTeams = useCallback(async () => {
    if (!userId) {
      setTeams([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      setTeams(await teamsApi.getTeams(userId))
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const reloadMembers = useCallback(async () => {
    if (!userId || !selectedTeamId) {
      setMembers([])
      return
    }

    setIsMembersLoading(true)
    try {
      setMembers(await teamsApi.getTeamMembers(userId, selectedTeamId))
    } finally {
      setIsMembersLoading(false)
    }
  }, [selectedTeamId, userId])

  useEffect(() => {
    void reloadTeams()
  }, [reloadTeams])

  useEffect(() => {
    void reloadMembers()
  }, [reloadMembers])

  const actions = useMemo(
    () => ({
      createTeam: async (name: string) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        const team = await teamsApi.createTeam(userId, name)
        await reloadTeams()
        return team
      },
      updateTeamName: async (teamId: number, name: string) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        await teamsApi.updateTeamName(userId, teamId, name)
        await reloadTeams()
      },
      deleteTeam: async (teamId: number) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        const nextTeamId = await teamsApi.deleteTeam(userId, teamId)
        await reloadTeams()
        return nextTeamId
      },
      addTeamMember: async (teamId: number, email: string) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        await teamsApi.addTeamMember(userId, teamId, email)
        await Promise.all([reloadTeams(), reloadMembers()])
      },
      removeTeamMember: async (teamId: number, memberUserId: string) => {
        if (!userId) {
          throw new Error("Missing user")
        }
        await teamsApi.removeTeamMember(userId, teamId, memberUserId)
        await Promise.all([reloadTeams(), reloadMembers()])
      },
    }),
    [reloadMembers, reloadTeams, userId],
  )

  return {
    teams,
    members,
    isLoading,
    isMembersLoading,
    error,
    reloadTeams,
    reloadMembers,
    ...actions,
  }
}
