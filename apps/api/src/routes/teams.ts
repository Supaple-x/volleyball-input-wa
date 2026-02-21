import { Hono } from 'hono'
import { getAllTeams, getTeam, upsertTeam, deleteTeam } from '../db/index.js'
import type { Team } from '@volleystats/shared'

const teams = new Hono()

teams.get('/', (c) => {
  return c.json(getAllTeams())
})

teams.get('/:id', (c) => {
  const team = getTeam(c.req.param('id'))
  if (!team) return c.json({ error: 'Команда не найдена' }, 404)
  return c.json(team)
})

teams.post('/', async (c) => {
  const team = await c.req.json<Team>()
  upsertTeam(team)
  return c.json(team, 201)
})

teams.put('/:id', async (c) => {
  const team = await c.req.json<Team>()
  team.id = c.req.param('id')
  upsertTeam(team)
  return c.json(team)
})

teams.delete('/:id', (c) => {
  const deleted = deleteTeam(c.req.param('id'))
  if (!deleted) return c.json({ error: 'Команда не найдена' }, 404)
  return c.json({ ok: true })
})

export default teams
