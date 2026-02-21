import Dexie, { type EntityTable } from 'dexie'
import type { Team, Player, Match, MatchEvent, SpecialEvent, Rally } from '@volleystats/shared'

export class VolleyStatsDB extends Dexie {
  teams!: EntityTable<Team, 'id'>
  players!: EntityTable<Player, 'id'>
  matches!: EntityTable<Match, 'id'>
  matchEvents!: EntityTable<MatchEvent, 'id'>
  specialEvents!: EntityTable<SpecialEvent, 'id'>
  rallies!: EntityTable<Rally, 'id'>

  constructor() {
    super('volleystats')

    this.version(1).stores({
      teams: 'id, name, city, createdAt',
      players: 'id, number, lastName, position',
      matches: 'id, date, homeTeamId, awayTeamId, status, createdAt',
      matchEvents: 'id, matchId, setNumber, timestamp, teamId, playerId, action, result',
      specialEvents: 'id, matchId, setNumber, timestamp, teamId, type',
    })

    this.version(2).stores({
      teams: 'id, name, city, createdAt',
      players: 'id, number, lastName, position',
      matches: 'id, date, homeTeamId, awayTeamId, status, createdAt',
      matchEvents: 'id, matchId, rallyId, setNumber, timestamp, teamId, playerId, action, result',
      specialEvents: 'id, matchId, setNumber, timestamp, teamId, type',
      rallies: 'id, matchId, setNumber, rallyNumber, timestamp, servingTeamId',
    })
  }
}

export const db = new VolleyStatsDB()
