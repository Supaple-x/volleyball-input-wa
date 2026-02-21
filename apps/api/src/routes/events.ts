import { Hono } from 'hono'
import {
  getMatchEvents,
  upsertEvent,
  deleteEvent,
  getSpecialEvents,
  upsertSpecialEvent,
} from '../db/index.js'
import type { MatchEvent, SpecialEvent } from '@volleystats/shared'

const events = new Hono()

// Match events
events.get('/:matchId/events', (c) => {
  return c.json(getMatchEvents(c.req.param('matchId')))
})

events.post('/:matchId/events', async (c) => {
  const event = await c.req.json<MatchEvent>()
  event.matchId = c.req.param('matchId')
  upsertEvent(event)
  return c.json(event, 201)
})

events.delete('/:matchId/events/:eventId', (c) => {
  const deleted = deleteEvent(c.req.param('eventId'))
  if (!deleted) return c.json({ error: 'Событие не найдено' }, 404)
  return c.json({ ok: true })
})

// Special events
events.get('/:matchId/special-events', (c) => {
  return c.json(getSpecialEvents(c.req.param('matchId')))
})

events.post('/:matchId/special-events', async (c) => {
  const event = await c.req.json<SpecialEvent>()
  event.matchId = c.req.param('matchId')
  upsertSpecialEvent(event)
  return c.json(event, 201)
})

export default events
