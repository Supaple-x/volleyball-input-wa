import { db } from './database'
import type { Team, Match, MatchEvent, SpecialEvent, Rally } from '@volleystats/shared'

const API_BASE = '/api'

interface SyncPayload {
  teams: Team[]
  matches: Match[]
  events: MatchEvent[]
  specialEvents: SpecialEvent[]
  rallies: Rally[]
}

/** Push all local data to the server (client-wins strategy) */
async function pushToServer(): Promise<void> {
  const [teams, matches, events, specialEvents, rallies] = await Promise.all([
    db.teams.toArray(),
    db.matches.toArray(),
    db.matchEvents.toArray(),
    db.specialEvents.toArray(),
    db.rallies.toArray(),
  ])

  await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teams, matches, events, specialEvents, rallies }),
  })
}

/** Pull all data from the server and merge into IndexedDB */
async function pullFromServer(): Promise<void> {
  const res = await fetch(`${API_BASE}/sync`)
  if (!res.ok) return

  const data: SyncPayload = await res.json()

  await db.transaction('rw', [db.teams, db.matches, db.matchEvents, db.specialEvents, db.rallies], async () => {
    if (data.teams.length) await db.teams.bulkPut(data.teams)
    if (data.matches.length) await db.matches.bulkPut(data.matches)
    if (data.events.length) await db.matchEvents.bulkPut(data.events)
    if (data.specialEvents.length) await db.specialEvents.bulkPut(data.specialEvents)
    if (data.rallies?.length) await db.rallies.bulkPut(data.rallies)
  })
}

/** Full sync: push local changes, then pull server state */
export async function syncAll(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pushToServer()
    await pullFromServer()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    console.warn('[sync]', message)
    return { ok: false, error: message }
  }
}

/** Start background sync: run on startup + listen for online events */
export function startBackgroundSync(): void {
  // Sync when app comes online
  window.addEventListener('online', () => {
    syncAll()
  })

  // Initial sync if online
  if (navigator.onLine) {
    syncAll()
  }
}
