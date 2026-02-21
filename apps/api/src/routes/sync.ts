import { Hono } from 'hono'
import {
  bulkSync,
  getAllTeams,
  getAllMatches,
  getMatchEvents,
  getSpecialEvents,
  getRallies,
} from '../db/index.js'
import type { Team, Match, MatchEvent, SpecialEvent, Rally } from '@volleystats/shared'

const sync = new Hono()

// Bulk upsert — client pushes all local data
sync.post('/', async (c) => {
  const body = await c.req.json<{
    teams?: Team[]
    matches?: Match[]
    events?: MatchEvent[]
    specialEvents?: SpecialEvent[]
    rallies?: Rally[]
  }>()

  bulkSync(body)

  return c.json({ ok: true, counts: {
    teams: body.teams?.length ?? 0,
    matches: body.matches?.length ?? 0,
    events: body.events?.length ?? 0,
    specialEvents: body.specialEvents?.length ?? 0,
    rallies: body.rallies?.length ?? 0,
  }})
})

// Pull all data from server — client fetches to populate IndexedDB
sync.get('/', (c) => {
  const teams = getAllTeams()
  const matches = getAllMatches()

  const events: MatchEvent[] = []
  const specialEvents: SpecialEvent[] = []
  const rallies: Rally[] = []
  for (const match of matches) {
    events.push(...getMatchEvents(match.id))
    specialEvents.push(...getSpecialEvents(match.id))
    rallies.push(...getRallies(match.id))
  }

  return c.json({ teams, matches, events, specialEvents, rallies })
})

export default sync
