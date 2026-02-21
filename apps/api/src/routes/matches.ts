import { Hono } from 'hono'
import { getAllMatches, getMatch, upsertMatch, deleteMatch } from '../db/index.js'
import type { Match } from '@volleystats/shared'

const matches = new Hono()

matches.get('/', (c) => {
  const status = c.req.query('status')
  return c.json(getAllMatches(status))
})

matches.get('/:id', (c) => {
  const match = getMatch(c.req.param('id'))
  if (!match) return c.json({ error: 'Матч не найден' }, 404)
  return c.json(match)
})

matches.post('/', async (c) => {
  const match = await c.req.json<Match>()
  upsertMatch(match)
  return c.json(match, 201)
})

matches.put('/:id', async (c) => {
  const match = await c.req.json<Match>()
  match.id = c.req.param('id')
  upsertMatch(match)
  return c.json(match)
})

matches.delete('/:id', (c) => {
  const deleted = deleteMatch(c.req.param('id'))
  if (!deleted) return c.json({ error: 'Матч не найден' }, 404)
  return c.json({ ok: true })
})

export default matches
