import type { Team, Match } from '@volleystats/shared'
import { db } from './database'
import { generateAwayLineup, AWAY_LIBERO_IDS } from '@/lib/awayPlayers'

const INEX_TEAM: Team = {
  id: 'team-inex',
  name: 'INEX TEAM',
  shortName: 'IT',
  city: 'Москва',
  players: [
    { id: 'p-21', number: 21, firstName: 'Георгий', lastName: 'Белов', position: 'libero' },
    { id: 'p-18', number: 18, firstName: 'Денис', lastName: 'Маренков', position: 'middle' },
    { id: 'p-15', number: 15, firstName: 'Владислав', lastName: 'Власов', position: 'middle' },
    { id: 'p-6', number: 6, firstName: 'Илья', lastName: 'Вагин', position: 'outside' },
    { id: 'p-5', number: 5, firstName: 'Илья', lastName: 'Смуров', position: 'setter' },
    { id: 'p-24', number: 24, firstName: 'Ахмед', lastName: 'Ибрагимов', position: 'outside' },
    { id: 'p-17', number: 17, firstName: 'Сергей', lastName: 'Муравьев', position: 'outside' },
    { id: 'p-9', number: 9, firstName: 'Евгений', lastName: 'Мокров', position: 'opposite' },
    { id: 'p-3', number: 3, firstName: 'Александр', lastName: 'Алейников', position: 'middle' },
    { id: 'p-8', number: 8, firstName: 'Константин', lastName: 'Картавенко', position: 'outside' },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const KOMUS: Team = {
  id: 'team-komus',
  name: 'Комус',
  shortName: 'KO',
  city: 'Москва',
  players: [
    { id: 'k-3', number: 3, firstName: 'Сидор', lastName: 'Сидоров', position: 'outside' },
    { id: 'k-4', number: 4, firstName: 'Павел', lastName: 'Павлов', position: 'outside' },
    { id: 'k-2', number: 2, firstName: 'Пётр', lastName: 'Петров', position: 'middle' },
    { id: 'k-5', number: 5, firstName: 'Сысой', lastName: 'Сысоев', position: 'setter' },
    { id: 'k-1', number: 1, firstName: 'Иван', lastName: 'Иванов', position: 'opposite' },
    { id: 'k-6', number: 6, firstName: 'Савва', lastName: 'Севрук', position: 'middle' },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const homeLineup = [
  { playerId: 'p-9', zone: 1 as const, isLibero: false },
  { playerId: 'p-17', zone: 2 as const, isLibero: false },
  { playerId: 'p-5', zone: 3 as const, isLibero: false },
  { playerId: 'p-24', zone: 4 as const, isLibero: false },
  { playerId: 'p-15', zone: 5 as const, isLibero: false },
  { playerId: 'p-6', zone: 6 as const, isLibero: false },
]

const awayLineup = generateAwayLineup()

const SAMPLE_MATCH: Match = {
  id: 'match-1',
  date: '2025-05-17T18:30:00Z',
  homeTeamId: 'team-inex',
  awayTeamId: 'team-komus',
  sets: [
    { number: 1, scoreHome: 25, scoreAway: 16, isFinished: true, firstServeTeamId: 'team-inex' },
    { number: 2, scoreHome: 27, scoreAway: 25, isFinished: true, firstServeTeamId: 'team-komus' },
    { number: 3, scoreHome: 25, scoreAway: 22, isFinished: true, firstServeTeamId: 'team-inex' },
  ],
  currentSet: 3,
  status: 'finished',
  homeLineup,
  awayLineup,
  setLineups: [
    { setNumber: 1, homeLineup, awayLineup },
    { setNumber: 2, homeLineup, awayLineup },
    { setNumber: 3, homeLineup, awayLineup },
  ],
  servingTeamId: 'team-inex',
  firstServeTeamId: 'team-inex',
  homeLiberoId: 'p-21',
  awayLiberoIds: [...AWAY_LIBERO_IDS],
  homeTimeouts: 0,
  awayTimeouts: 0,
  homeSubstitutions: 2,
  awaySubstitutions: 0,
  createdAt: '2025-05-17T18:30:00Z',
  updatedAt: '2025-05-17T20:15:00Z',
}

export async function seedDatabase() {
  const teamCount = await db.teams.count()
  if (teamCount > 0) return

  await db.transaction('rw', db.teams, db.matches, async () => {
    await db.teams.bulkAdd([INEX_TEAM, KOMUS])
    await db.matches.add(SAMPLE_MATCH)
  })

  console.log('[Seed] Database seeded with sample data')
}
