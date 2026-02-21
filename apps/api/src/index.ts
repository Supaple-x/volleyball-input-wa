import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import teams from './routes/teams.js'
import matches from './routes/matches.js'
import events from './routes/events.js'
import sync from './routes/sync.js'

const app = new Hono()

app.use('*', cors())

// Mount routes
app.route('/api/teams', teams)
app.route('/api/matches', matches)
app.route('/api/matches', events)
app.route('/api/sync', sync)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }))

const port = Number(process.env.PORT) || 3002

console.log(`VolleyStats API running on port ${port}`)
serve({ fetch: app.fetch, port })
