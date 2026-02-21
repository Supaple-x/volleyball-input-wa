import type { CourtZone, LineupEntry } from '@volleystats/shared'

// ─── Away Player IDs ────────────────────────────────────────────

export const AWAY_PLAYER_IDS = ['away-p1', 'away-p2', 'away-p3', 'away-p4', 'away-p5', 'away-p6'] as const
export const AWAY_LIBERO_IDS = ['away-l1', 'away-l2'] as const
export const ALL_AWAY_IDS = [...AWAY_PLAYER_IDS, ...AWAY_LIBERO_IDS] as const

// ─── Display Names ──────────────────────────────────────────────

const AWAY_PLAYER_NAMES: Record<string, string> = {
  'away-p1': 'Игрок 1',
  'away-p2': 'Игрок 2',
  'away-p3': 'Игрок 3',
  'away-p4': 'Игрок 4',
  'away-p5': 'Игрок 5',
  'away-p6': 'Игрок 6',
  'away-l1': 'Либеро 1',
  'away-l2': 'Либеро 2',
}

/** Short names for court circles */
const AWAY_SHORT_NAMES: Record<string, string> = {
  'away-p1': 'Игр1',
  'away-p2': 'Игр2',
  'away-p3': 'Игр3',
  'away-p4': 'Игр4',
  'away-p5': 'Игр5',
  'away-p6': 'Игр6',
  'away-l1': 'Л1',
  'away-l2': 'Л2',
}

// ─── Helpers ────────────────────────────────────────────────────

export function isAwayPlayerId(id: string): boolean {
  return id.startsWith('away-')
}

export function getAwayPlayerDisplayName(id: string): string {
  return AWAY_PLAYER_NAMES[id] || id
}

export function getAwayPlayerShortName(id: string): string {
  return AWAY_SHORT_NAMES[id] || id
}

/** Generate a standard away lineup: 6 players in zones 1-6. */
export function generateAwayLineup(): LineupEntry[] {
  return AWAY_PLAYER_IDS.map((id, i) => ({
    playerId: id,
    zone: (i + 1) as CourtZone,
    isLibero: false,
  }))
}
