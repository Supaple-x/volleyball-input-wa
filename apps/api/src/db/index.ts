import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { Team, Match, MatchEvent, SpecialEvent, Rally } from '@volleystats/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '..', '..', 'data', 'volleystats.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Create tables
const schema = readFileSync(join(__dirname, '..', '..', 'src', 'db', 'schema.sql'), 'utf-8')
db.exec(schema)

// db instance is used internally — functions are exported below

// --- Team helpers ---

interface TeamRow {
  id: string
  name: string
  short_name: string | null
  city: string | null
  logo_url: string | null
  players: string
  created_at: string
  updated_at: string
}

function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name ?? undefined,
    city: row.city ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    players: JSON.parse(row.players),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getAllTeams(): Team[] {
  const rows = db.prepare('SELECT * FROM teams ORDER BY name').all() as TeamRow[]
  return rows.map(rowToTeam)
}

export function getTeam(id: string): Team | null {
  const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as TeamRow | undefined
  return row ? rowToTeam(row) : null
}

export function upsertTeam(team: Team): void {
  db.prepare(`
    INSERT INTO teams (id, name, short_name, city, logo_url, players, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      short_name = excluded.short_name,
      city = excluded.city,
      logo_url = excluded.logo_url,
      players = excluded.players,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at > teams.updated_at
  `).run(
    team.id,
    team.name,
    team.shortName ?? null,
    team.city ?? null,
    team.logoUrl ?? null,
    JSON.stringify(team.players),
    team.createdAt,
    team.updatedAt,
  )
}

export function deleteTeam(id: string): boolean {
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(id)
  return result.changes > 0
}

// --- Match helpers ---

interface MatchRow {
  id: string
  date: string
  home_team_id: string
  away_team_id: string
  sets: string
  current_set: number
  status: string
  home_lineup: string
  away_lineup: string
  set_lineups: string | null
  serving_team_id: string | null
  first_serve_team_id: string | null
  home_libero_id: string | null
  away_libero_id: string | null
  home_libero_replaced_player_id: string | null
  away_libero_replaced_player_id: string | null
  home_timeouts: number
  away_timeouts: number
  home_substitutions: number
  away_substitutions: number
  created_at: string
  updated_at: string
}

function rowToMatch(row: MatchRow): Match {
  return {
    id: row.id,
    date: row.date,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    sets: JSON.parse(row.sets),
    currentSet: row.current_set,
    status: row.status as Match['status'],
    homeLineup: JSON.parse(row.home_lineup),
    awayLineup: JSON.parse(row.away_lineup),
    setLineups: row.set_lineups ? JSON.parse(row.set_lineups) : undefined,
    servingTeamId: row.serving_team_id ?? undefined,
    firstServeTeamId: row.first_serve_team_id ?? undefined,
    homeLiberoId: row.home_libero_id ?? undefined,
    awayLiberoId: row.away_libero_id ?? undefined,
    homeLiberoReplacedPlayerId: row.home_libero_replaced_player_id ?? undefined,
    awayLiberoReplacedPlayerId: row.away_libero_replaced_player_id ?? undefined,
    homeTimeouts: row.home_timeouts,
    awayTimeouts: row.away_timeouts,
    homeSubstitutions: row.home_substitutions,
    awaySubstitutions: row.away_substitutions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getAllMatches(status?: string): Match[] {
  if (status) {
    const rows = db.prepare('SELECT * FROM matches WHERE status = ? ORDER BY date DESC').all(status) as MatchRow[]
    return rows.map(rowToMatch)
  }
  const rows = db.prepare('SELECT * FROM matches ORDER BY date DESC').all() as MatchRow[]
  return rows.map(rowToMatch)
}

export function getMatch(id: string): Match | null {
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | undefined
  return row ? rowToMatch(row) : null
}

export function upsertMatch(match: Match): void {
  db.prepare(`
    INSERT INTO matches (id, date, home_team_id, away_team_id, sets, current_set, status,
      home_lineup, away_lineup, set_lineups, serving_team_id, first_serve_team_id,
      home_libero_id, away_libero_id, home_libero_replaced_player_id, away_libero_replaced_player_id,
      home_timeouts, away_timeouts, home_substitutions, away_substitutions,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      sets = excluded.sets,
      current_set = excluded.current_set,
      status = excluded.status,
      home_lineup = excluded.home_lineup,
      away_lineup = excluded.away_lineup,
      set_lineups = excluded.set_lineups,
      serving_team_id = excluded.serving_team_id,
      first_serve_team_id = excluded.first_serve_team_id,
      home_libero_id = excluded.home_libero_id,
      away_libero_id = excluded.away_libero_id,
      home_libero_replaced_player_id = excluded.home_libero_replaced_player_id,
      away_libero_replaced_player_id = excluded.away_libero_replaced_player_id,
      home_timeouts = excluded.home_timeouts,
      away_timeouts = excluded.away_timeouts,
      home_substitutions = excluded.home_substitutions,
      away_substitutions = excluded.away_substitutions,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at > matches.updated_at
  `).run(
    match.id,
    match.date,
    match.homeTeamId,
    match.awayTeamId,
    JSON.stringify(match.sets),
    match.currentSet,
    match.status,
    JSON.stringify(match.homeLineup),
    JSON.stringify(match.awayLineup),
    match.setLineups ? JSON.stringify(match.setLineups) : null,
    match.servingTeamId ?? null,
    match.firstServeTeamId ?? null,
    match.homeLiberoId ?? null,
    match.awayLiberoId ?? null,
    match.homeLiberoReplacedPlayerId ?? null,
    match.awayLiberoReplacedPlayerId ?? null,
    match.homeTimeouts,
    match.awayTimeouts,
    match.homeSubstitutions,
    match.awaySubstitutions,
    match.createdAt,
    match.updatedAt,
  )
}

export function deleteMatch(id: string): boolean {
  const result = db.prepare('DELETE FROM matches WHERE id = ?').run(id)
  return result.changes > 0
}

// --- MatchEvent helpers ---

interface EventRow {
  id: string
  match_id: string
  rally_id: string | null
  set_number: number
  timestamp: number
  team_id: string
  player_id: string
  action: string
  result: string
  zone: number | null
  score_home: number
  score_away: number
  meta: string | null
}

function rowToEvent(row: EventRow): MatchEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    rallyId: row.rally_id ?? undefined,
    setNumber: row.set_number,
    timestamp: row.timestamp,
    teamId: row.team_id,
    playerId: row.player_id,
    action: row.action as MatchEvent['action'],
    result: row.result as MatchEvent['result'],
    zone: row.zone as MatchEvent['zone'],
    scoreHome: row.score_home,
    scoreAway: row.score_away,
    meta: row.meta ? JSON.parse(row.meta) : undefined,
  }
}

export function getMatchEvents(matchId: string): MatchEvent[] {
  const rows = db.prepare(
    'SELECT * FROM match_events WHERE match_id = ? ORDER BY timestamp',
  ).all(matchId) as EventRow[]
  return rows.map(rowToEvent)
}

export function upsertEvent(event: MatchEvent): void {
  db.prepare(`
    INSERT INTO match_events (id, match_id, rally_id, set_number, timestamp, team_id, player_id, action, result, zone, score_home, score_away, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    event.id,
    event.matchId,
    event.rallyId ?? null,
    event.setNumber,
    event.timestamp,
    event.teamId,
    event.playerId,
    event.action,
    event.result,
    event.zone ?? null,
    event.scoreHome,
    event.scoreAway,
    event.meta ? JSON.stringify(event.meta) : null,
  )
}

export function deleteEvent(eventId: string): boolean {
  const result = db.prepare('DELETE FROM match_events WHERE id = ?').run(eventId)
  return result.changes > 0
}

// --- SpecialEvent helpers ---

interface SpecialRow {
  id: string
  match_id: string
  set_number: number
  timestamp: number
  team_id: string
  type: string
  meta: string | null
}

function rowToSpecial(row: SpecialRow): SpecialEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    setNumber: row.set_number,
    timestamp: row.timestamp,
    teamId: row.team_id,
    type: row.type as SpecialEvent['type'],
    meta: row.meta ? JSON.parse(row.meta) : undefined,
  }
}

export function getSpecialEvents(matchId: string): SpecialEvent[] {
  const rows = db.prepare(
    'SELECT * FROM special_events WHERE match_id = ? ORDER BY timestamp',
  ).all(matchId) as SpecialRow[]
  return rows.map(rowToSpecial)
}

export function upsertSpecialEvent(event: SpecialEvent): void {
  db.prepare(`
    INSERT INTO special_events (id, match_id, set_number, timestamp, team_id, type, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    event.id,
    event.matchId,
    event.setNumber,
    event.timestamp,
    event.teamId,
    event.type,
    event.meta ? JSON.stringify(event.meta) : null,
  )
}

// --- Rally helpers ---

interface RallyRow {
  id: string
  match_id: string
  set_number: number
  rally_number: number
  serving_team_id: string
  server_player_id: string
  score_home_before: number
  score_away_before: number
  score_home_after: number
  score_away_after: number
  point_won_by_team_id: string | null
  was_ace: number
  was_serve_error: number
  was_reception_error: number
  timestamp: number
}

function rowToRally(row: RallyRow): Rally {
  return {
    id: row.id,
    matchId: row.match_id,
    setNumber: row.set_number,
    rallyNumber: row.rally_number,
    servingTeamId: row.serving_team_id,
    serverPlayerId: row.server_player_id,
    scoreHomeBefore: row.score_home_before,
    scoreAwayBefore: row.score_away_before,
    scoreHomeAfter: row.score_home_after,
    scoreAwayAfter: row.score_away_after,
    pointWonByTeamId: row.point_won_by_team_id,
    wasAce: !!row.was_ace,
    wasServeError: !!row.was_serve_error,
    wasReceptionError: !!row.was_reception_error,
    timestamp: row.timestamp,
  }
}

export function getRallies(matchId: string): Rally[] {
  const rows = db.prepare(
    'SELECT * FROM rallies WHERE match_id = ? ORDER BY set_number, rally_number',
  ).all(matchId) as RallyRow[]
  return rows.map(rowToRally)
}

export function upsertRally(rally: Rally): void {
  db.prepare(`
    INSERT INTO rallies (id, match_id, set_number, rally_number, serving_team_id, server_player_id,
      score_home_before, score_away_before, score_home_after, score_away_after,
      point_won_by_team_id, was_ace, was_serve_error, was_reception_error, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    rally.id,
    rally.matchId,
    rally.setNumber,
    rally.rallyNumber,
    rally.servingTeamId,
    rally.serverPlayerId,
    rally.scoreHomeBefore,
    rally.scoreAwayBefore,
    rally.scoreHomeAfter,
    rally.scoreAwayAfter,
    rally.pointWonByTeamId,
    rally.wasAce ? 1 : 0,
    rally.wasServeError ? 1 : 0,
    rally.wasReceptionError ? 1 : 0,
    rally.timestamp,
  )
}

// --- Bulk sync ---

export function bulkSync(data: {
  teams?: Team[]
  matches?: Match[]
  events?: MatchEvent[]
  specialEvents?: SpecialEvent[]
  rallies?: Rally[]
}): void {
  const transaction = db.transaction(() => {
    if (data.teams) {
      for (const team of data.teams) upsertTeam(team)
    }
    if (data.matches) {
      for (const match of data.matches) upsertMatch(match)
    }
    if (data.events) {
      for (const event of data.events) upsertEvent(event)
    }
    if (data.specialEvents) {
      for (const event of data.specialEvents) upsertSpecialEvent(event)
    }
    if (data.rallies) {
      for (const rally of data.rallies) upsertRally(rally)
    }
  })
  transaction()
}
