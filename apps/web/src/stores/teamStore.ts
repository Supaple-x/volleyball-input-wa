import { create } from 'zustand'
import type { Team } from '@volleystats/shared'
import { db } from '@/db/database'

interface TeamState {
  teams: Team[]
  loading: boolean
  loadTeams: () => Promise<void>
  addTeam: (team: Team) => Promise<void>
  updateTeam: (team: Team) => Promise<void>
  deleteTeam: (id: string) => Promise<void>
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  loading: false,

  loadTeams: async () => {
    set({ loading: true })
    const teams = await db.teams.toArray()
    set({ teams, loading: false })
  },

  addTeam: async (team) => {
    await db.teams.add(team)
    const teams = await db.teams.toArray()
    set({ teams })
  },

  updateTeam: async (team) => {
    await db.teams.put(team)
    const teams = await db.teams.toArray()
    set({ teams })
  },

  deleteTeam: async (id) => {
    await db.teams.delete(id)
    const teams = await db.teams.toArray()
    set({ teams })
  },
}))
