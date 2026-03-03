import type {
  Match,
  MatchEvent,
  MatchSet,
  LineupEntry,
  CourtZone,
  ActionType,
  ActionResult,
  RallyPhase,
  Rally,
} from '@volleystats/shared'
import { VOLLEYBALL_RULES } from '@volleystats/shared'

// ─── Rally State ────────────────────────────────────────────────

export interface RallyState {
  phase: RallyPhase
  rallyId: string
  servingTeamId: string
  serverPlayerId: string
  receivingTeamId: string
  events: MatchEvent[]
  scoreHomeBefore: number
  scoreAwayBefore: number
}

export interface ActionOutcome {
  newPhase: RallyPhase
  newEvents: MatchEvent[]
  updatedEvents: MatchEvent[]
  scoreChange: { home: number; away: number } | null
  rallyComplete: boolean
  sideOut: boolean
}

export interface ActionConfig {
  action: ActionType
  result: ActionResult
  quality?: string
  label: string
  variant: 'success' | 'error' | 'neutral'
  subOptions?: ActionConfig[]
}

// ─── ID Generator ───────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Scoring ────────────────────────────────────────────────────

/** Does this action score a point for the acting team? */
export function isPointForTeam(action: ActionType, result: ActionResult): boolean {
  return result === 'success' && (action === 'attack' || action === 'block' || action === 'serve')
}

/** Does this action give a point to the opponent? */
export function isPointForOpponent(action: ActionType, result: ActionResult): boolean {
  return result === 'error' && (action === 'serve' || action === 'attack' || action === 'block' || action === 'reception' || action === 'defense')
}

/** Calculate score change from an action. Returns {home, away} deltas. */
export function getScoreChange(
  action: ActionType,
  result: ActionResult,
  actingTeamId: string,
  homeTeamId: string,
): { home: number; away: number } | null {
  if (isPointForTeam(action, result)) {
    return actingTeamId === homeTeamId ? { home: 1, away: 0 } : { home: 0, away: 1 }
  }
  if (isPointForOpponent(action, result)) {
    return actingTeamId === homeTeamId ? { home: 0, away: 1 } : { home: 1, away: 0 }
  }
  return null
}

// ─── Set / Match Win ────────────────────────────────────────────

export function isSetWon(
  scoreHome: number,
  scoreAway: number,
  isTiebreak: boolean,
): boolean {
  const target = isTiebreak ? VOLLEYBALL_RULES.POINTS_TO_WIN_TIEBREAK : VOLLEYBALL_RULES.POINTS_TO_WIN_SET
  const diff = Math.abs(scoreHome - scoreAway)
  const maxScore = Math.max(scoreHome, scoreAway)
  return maxScore >= target && diff >= VOLLEYBALL_RULES.MIN_ADVANTAGE
}

export function countSetsWon(sets: MatchSet[]): { home: number; away: number } {
  let home = 0
  let away = 0
  for (const s of sets) {
    if (s.isFinished) {
      if (s.scoreHome > s.scoreAway) home++
      else away++
    }
  }
  return { home, away }
}

export function isMatchWon(sets: MatchSet[]): { winner: 'home' | 'away' } | null {
  const { home, away } = countSetsWon(sets)
  if (home >= VOLLEYBALL_RULES.SETS_TO_WIN) return { winner: 'home' }
  if (away >= VOLLEYBALL_RULES.SETS_TO_WIN) return { winner: 'away' }
  return null
}

export function isTiebreakSet(setNumber: number): boolean {
  return setNumber === VOLLEYBALL_RULES.TIEBREAK_SET
}

// ─── Rotation ───────────────────────────────────────────────────

const ROTATION_MAP: Record<CourtZone, CourtZone> = {
  1: 6, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
}

const REVERSE_ROTATION_MAP: Record<CourtZone, CourtZone> = {
  6: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6,
}

/** Rotate lineup clockwise: zone 1→6, 6→5, 5→4, 4→3, 3→2, 2→1 */
export function rotateLineup(lineup: LineupEntry[]): LineupEntry[] {
  return lineup.map((entry) => ({
    ...entry,
    zone: ROTATION_MAP[entry.zone],
  }))
}

/** Reverse rotation (undo): zone 6→1, 5→6, 4→5, 3→4, 2→3, 1→2 */
export function reverseRotateLineup(lineup: LineupEntry[]): LineupEntry[] {
  return lineup.map((entry) => ({
    ...entry,
    zone: REVERSE_ROTATION_MAP[entry.zone],
  }))
}

/** Should a team rotate? Rotation happens on side-out (receiving team wins point). */
export function shouldRotate(
  pointWonByTeamId: string,
  servingTeamId: string,
): boolean {
  return pointWonByTeamId !== servingTeamId
}

// ─── Court Zones ────────────────────────────────────────────────

export function isBackRow(zone: CourtZone): boolean {
  return zone === 1 || zone === 5 || zone === 6
}

export function isFrontRow(zone: CourtZone): boolean {
  return zone === 2 || zone === 3 || zone === 4
}

/** Get the player in zone 1 (server position). */
export function getServer(lineup: LineupEntry[]): LineupEntry | undefined {
  return lineup.find((e) => e.zone === 1)
}

// ─── Libero ─────────────────────────────────────────────────────

/** Check if the libero is in the front row and must be swapped out. */
export function shouldLiberoSwapOut(
  lineup: LineupEntry[],
  liberoPlayerId: string | null | undefined,
): boolean {
  if (!liberoPlayerId) return false
  const liberoEntry = lineup.find((e) => e.playerId === liberoPlayerId)
  if (!liberoEntry) return false
  return isFrontRow(liberoEntry.zone)
}

/** Get back-row players eligible for libero replacement.
 *  Zone 1 excluded only when our team is serving (libero cannot serve).
 *  When opponent is serving, zones 1, 5, 6 are all available. */
export function getLiberoEligiblePlayers(lineup: LineupEntry[], isTeamServing: boolean = true): LineupEntry[] {
  return lineup.filter((e) => {
    if (!isBackRow(e.zone) || e.isLibero) return false
    if (e.zone === 1 && isTeamServing) return false
    return true
  })
}

/**
 * Auto-swap out any libero that is in an illegal position after rotation.
 * Illegal positions: front row (zones 2, 3, 4) always;
 * zone 1 when the team is about to serve (libero cannot serve).
 */
export function autoSwapLiberoOut(
  lineup: LineupEntry[],
  liberoIds: string[],
  replacements: Record<string, string>,
  isTeamServing: boolean = false,
): { lineup: LineupEntry[]; replacements: Record<string, string>; swappedOut: string[] } {
  let updatedLineup = [...lineup]
  const updatedReplacements = { ...replacements }
  const swappedOut: string[] = []

  for (const liberoId of liberoIds) {
    const entry = updatedLineup.find((e) => e.playerId === liberoId)
    if (!entry) continue

    const mustSwapOut = isFrontRow(entry.zone) || (isTeamServing && entry.zone === 1)
    if (!mustSwapOut) continue

    const replacedPlayerId = updatedReplacements[liberoId]
    if (!replacedPlayerId) continue

    // Swap the libero back out
    updatedLineup = updatedLineup.map((e) =>
      e.playerId === liberoId
        ? { ...e, playerId: replacedPlayerId, isLibero: false }
        : e,
    )
    delete updatedReplacements[liberoId]
    swappedOut.push(liberoId)
  }

  return { lineup: updatedLineup, replacements: updatedReplacements, swappedOut }
}

// ─── Serving Team Per Set ───────────────────────────────────────

/** Determine which team serves first in a set (alternating from match start). */
export function getServingTeamForSet(
  setNumber: number,
  firstServeTeamId: string,
  homeTeamId: string,
  awayTeamId: string,
): string {
  const otherTeamId = firstServeTeamId === homeTeamId ? awayTeamId : homeTeamId
  // Odd sets: first team serves, even sets: other team
  return setNumber % 2 === 1 ? firstServeTeamId : otherTeamId
}

// ─── Rally State Machine ────────────────────────────────────────

/** Start a new rally. */
export function startRally(
  match: Match,
  rallyNumber: number,
  scoreHome: number,
  scoreAway: number,
): RallyState {
  const servingTeamId = match.servingTeamId || match.homeTeamId
  const receivingTeamId = servingTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId
  const servingLineup = servingTeamId === match.homeTeamId ? match.homeLineup : match.awayLineup
  const server = getServer(servingLineup)

  // Always start at serve (both teams now have lineups)
  const phase: RallyPhase = 'serve'

  return {
    phase,
    rallyId: generateId(),
    servingTeamId,
    serverPlayerId: server?.playerId || '',
    receivingTeamId,
    events: [],
    scoreHomeBefore: scoreHome,
    scoreAwayBefore: scoreAway,
  }
}

/** Process an action within the current rally. Returns the outcome. */
export function processAction(
  rally: RallyState,
  match: Match,
  action: ActionType,
  result: ActionResult,
  playerId: string,
  teamId: string,
  quality?: string,
): ActionOutcome {
  const homeTeamId = match.homeTeamId

  let newPhase: RallyPhase = rally.phase
  let rallyComplete = false
  let sideOut = false
  const newEvents: MatchEvent[] = []
  const updatedEvents: MatchEvent[] = []
  let scoreChange: { home: number; away: number } | null = null

  const scoreHome = rally.scoreHomeBefore + (rally.events.reduce((sum, e) => {
    const sc = getScoreChange(e.action, e.result, e.teamId, homeTeamId)
    return sum + (sc?.home || 0)
  }, 0))
  const scoreAway = rally.scoreAwayBefore + (rally.events.reduce((sum, e) => {
    const sc = getScoreChange(e.action, e.result, e.teamId, homeTeamId)
    return sum + (sc?.away || 0)
  }, 0))

  // Create the main event
  const mainEvent: MatchEvent = {
    id: generateId(),
    matchId: match.id,
    rallyId: rally.rallyId,
    setNumber: match.currentSet,
    timestamp: Date.now(),
    teamId,
    playerId,
    action,
    result,
    scoreHome,
    scoreAway,
    meta: quality ? { quality } : undefined,
  }

  switch (rally.phase) {
    case 'serve': {
      if (result === 'error') {
        // Serve error → +1 opponent, rally over, side-out
        scoreChange = getScoreChange(action, result, teamId, homeTeamId)
        mainEvent.scoreHome = scoreHome + (scoreChange?.home || 0)
        mainEvent.scoreAway = scoreAway + (scoreChange?.away || 0)
        newEvents.push(mainEvent)
        newPhase = 'rally_over'
        rallyComplete = true
        sideOut = true
      } else if (result === 'success') {
        // Home ace → +1 home, rally over
        scoreChange = getScoreChange(action, result, teamId, homeTeamId)
        mainEvent.scoreHome = scoreHome + (scoreChange?.home || 0)
        mainEvent.scoreAway = scoreAway + (scoreChange?.away || 0)
        newEvents.push(mainEvent)
        newPhase = 'rally_over'
        rallyComplete = true
      } else {
        // Neutral serve (in play, pressure) → go to reception
        mainEvent.scoreHome = scoreHome
        mainEvent.scoreAway = scoreAway
        newEvents.push(mainEvent)
        newPhase = 'reception'
      }
      break
    }

    case 'reception': {
      if (result === 'error') {
        // Reception error → +1 serving team
        const servingIsHome = rally.servingTeamId === homeTeamId
        scoreChange = servingIsHome ? { home: 1, away: 0 } : { home: 0, away: 1 }
        mainEvent.scoreHome = scoreHome + scoreChange.home
        mainEvent.scoreAway = scoreAway + scoreChange.away
        newEvents.push(mainEvent)
        newPhase = 'rally_over'
        rallyComplete = true
      } else {
        // Good/neutral reception → move to in_play
        mainEvent.scoreHome = scoreHome
        mainEvent.scoreAway = scoreAway
        newEvents.push(mainEvent)
        newPhase = 'in_play'
      }

      // Retroactively update opponent serve quality based on reception
      const serveEvent = rally.events.find(
        (e) => e.action === 'serve' && e.teamId !== teamId && e.result === 'neutral',
      )
      if (serveEvent) {
        let serveQuality: string
        if (result === 'error') {
          serveQuality = 'ace'
        } else if (quality === 'excellent' || quality === 'positive') {
          serveQuality = 'in_play'
        } else {
          serveQuality = 'pressure'
        }
        if (serveQuality !== serveEvent.meta?.quality) {
          updatedEvents.push({ ...serveEvent, meta: { ...serveEvent.meta, quality: serveQuality } })
        }
      }
      break
    }

    case 'in_play': {
      scoreChange = getScoreChange(action, result, teamId, homeTeamId)

      if (scoreChange) {
        // Point-scoring action → rally over
        mainEvent.scoreHome = scoreHome + scoreChange.home
        mainEvent.scoreAway = scoreAway + scoreChange.away
        newEvents.push(mainEvent)
        newPhase = 'rally_over'
        rallyComplete = true

        // Determine side-out
        const pointWonByTeamId = scoreChange.home > 0 ? homeTeamId : match.awayTeamId
        sideOut = shouldRotate(pointWonByTeamId, rally.servingTeamId)
      } else {
        // Non-scoring action → rally continues
        mainEvent.scoreHome = scoreHome
        mainEvent.scoreAway = scoreAway
        newEvents.push(mainEvent)
        newPhase = 'in_play'
      }

      // Retroactively update attack quality based on opponent response.
      // Analogous to how reception updates serve quality.
      if (action === 'block' || action === 'defense') {
        const lastAttackEvent = [...rally.events].reverse().find(
          (e) => e.action === 'attack' && e.teamId !== teamId && e.result === 'neutral',
        )
        if (lastAttackEvent) {
          let attackQuality: string | undefined
          if (action === 'block' && result === 'success') {
            // Opponent blocked → attack was stuffed
            attackQuality = 'attack_blocked'
          } else if (result === 'error') {
            // Opponent defense/block error after our attack → attack was effective (forced error)
            attackQuality = 'attack_kill'
          }
          if (attackQuality && attackQuality !== lastAttackEvent.meta?.quality) {
            updatedEvents.push({
              ...lastAttackEvent,
              meta: { ...lastAttackEvent.meta, quality: attackQuality },
            })
          }
        }
      }

      break
    }

    default:
      // Shouldn't happen, but handle gracefully
      mainEvent.scoreHome = scoreHome
      mainEvent.scoreAway = scoreAway
      newEvents.push(mainEvent)
      break
  }

  return {
    newPhase,
    newEvents,
    updatedEvents,
    scoreChange,
    rallyComplete,
    sideOut,
  }
}

// ─── Available Actions ──────────────────────────────────────────

export interface PhaseActions {
  /** Which team is expected to act (null = either) */
  expectedTeamId: string | null
  /** Description for UI prompt */
  prompt: string
  /** Available action sections */
  sections: Array<{
    title: string
    actions: ActionConfig[]
  }>
}

/** Get available actions based on current rally phase. */
export function getAvailableActions(
  phase: RallyPhase,
  servingTeamId: string,
  receivingTeamId: string,
  zone?: CourtZone,
): PhaseActions {
  switch (phase) {
    case 'serve':
      return {
        expectedTeamId: servingTeamId,
        prompt: 'Выберите тип подачи',
        sections: [
          {
            title: 'Подача',
            actions: [
              { action: 'serve', result: 'neutral', quality: 'in_play', label: 'В игру', variant: 'neutral' },
              { action: 'serve', result: 'error', quality: 'serve_error', label: 'Ошиб', variant: 'error' },
            ],
          },
        ],
      }

    case 'reception':
      return {
        expectedTeamId: receivingTeamId,
        prompt: 'Выберите игрока и оцените приём',
        sections: [
          {
            title: 'Приём',
            actions: [
              { action: 'reception', result: 'success', quality: 'excellent', label: '++', variant: 'success' },
              { action: 'reception', result: 'success', quality: 'positive', label: '+', variant: 'success' },
              { action: 'reception', result: 'neutral', quality: 'ok', label: '!', variant: 'neutral' },
              { action: 'reception', result: 'neutral', quality: 'negative', label: '−', variant: 'neutral' },
              { action: 'reception', result: 'neutral', quality: 'over', label: '/', variant: 'neutral' },
              { action: 'reception', result: 'neutral', quality: 'half', label: '=', variant: 'neutral' },
              { action: 'reception', result: 'error', quality: 'reception_error', label: 'Ошиб', variant: 'error' },
            ],
          },
        ],
      }

    case 'in_play': {
      const blockActions: ActionConfig[] = [
        { action: 'block', result: 'success', label: '+', variant: 'success' },
        { action: 'block', result: 'error', quality: 'block_error', label: '−', variant: 'error' },
      ]
      if (zone && isFrontRow(zone)) {
        blockActions.push(
          { action: 'block', result: 'neutral', quality: 'soft', label: 'с', variant: 'neutral' },
          { action: 'block', result: 'neutral', quality: 'touch', label: '0', variant: 'neutral' },
        )
      }
      return {
        expectedTeamId: null,
        prompt: 'Выберите игрока и действие',
        sections: [
          {
            title: 'Атака',
            actions: [
              { action: 'attack', result: 'success', label: '+', variant: 'success' },
              { action: 'attack', result: 'neutral', quality: 'in_play', label: 'В игру', variant: 'neutral' },
              {
                action: 'attack', result: 'error', label: '−', variant: 'error',
                subOptions: [
                  { action: 'attack', result: 'error', quality: 'out_error', label: 'Аут', variant: 'error' },
                  { action: 'attack', result: 'error', quality: 'net_error', label: 'Другая ошибка', variant: 'error' },
                ],
              },
            ],
          },
          {
            title: 'Блок',
            actions: blockActions,
          },
          {
            title: 'Защита',
            actions: [
              { action: 'defense', result: 'success', label: '+', variant: 'success' },
              { action: 'defense', result: 'error', quality: 'defense_error', label: '−', variant: 'error' },
            ],
          },
          {
            title: 'Перед',
            actions: [
              { action: 'defense', result: 'error', quality: 'setting_error', label: '−', variant: 'error' },
            ],
          },
        ],
      }
    }

    default:
      return {
        expectedTeamId: null,
        prompt: '',
        sections: [],
      }
  }
}

// ─── Rally Completion → Rally Record ────────────────────────────

/** Build a Rally record from completed rally state. */
export function buildRallyRecord(
  rally: RallyState,
  allEvents: MatchEvent[],
  matchId: string,
  rallyNumber: number,
): Rally {
  const lastEvent = allEvents[allEvents.length - 1]
  const scoreHomeAfter = lastEvent?.scoreHome ?? rally.scoreHomeBefore
  const scoreAwayAfter = lastEvent?.scoreAway ?? rally.scoreAwayBefore

  // Determine who won the point
  let pointWonByTeamId: string | null = null
  if (scoreHomeAfter > rally.scoreHomeBefore) {
    pointWonByTeamId = rally.servingTeamId === rally.receivingTeamId
      ? rally.receivingTeamId
      : (scoreHomeAfter > rally.scoreHomeBefore ? rally.servingTeamId : rally.receivingTeamId)
  }
  // Simplified: just check score delta
  const homeDelta = scoreHomeAfter - rally.scoreHomeBefore
  const awayDelta = scoreAwayAfter - rally.scoreAwayBefore
  if (homeDelta > 0) {
    // Home team scored
    pointWonByTeamId = allEvents[0]?.matchId ? findPointWinner(allEvents, rally) : null
  } else if (awayDelta > 0) {
    pointWonByTeamId = findPointWinner(allEvents, rally)
  }

  const wasAce = allEvents.some((e) => e.action === 'serve' && e.meta?.quality === 'ace')
  const wasServeError = allEvents.some((e) => e.action === 'serve' && e.result === 'error')
  const wasReceptionError = allEvents.some((e) => e.action === 'reception' && e.result === 'error')

  return {
    id: rally.rallyId,
    matchId,
    setNumber: lastEvent?.setNumber ?? 1,
    rallyNumber,
    servingTeamId: rally.servingTeamId,
    serverPlayerId: rally.serverPlayerId,
    scoreHomeBefore: rally.scoreHomeBefore,
    scoreAwayBefore: rally.scoreAwayBefore,
    scoreHomeAfter,
    scoreAwayAfter,
    pointWonByTeamId,
    wasAce,
    wasServeError,
    wasReceptionError,
    timestamp: rally.events[0]?.timestamp ?? Date.now(),
  }
}

// ─── Away (Opponent) Available Actions ─────────────────────────

/** Simplified actions for the opponent team. */
export function getAwayAvailableActions(
  phase: RallyPhase,
  servingTeamId: string,
  zone?: CourtZone,
): PhaseActions {
  switch (phase) {
    case 'serve':
      return {
        expectedTeamId: servingTeamId,
        prompt: 'Подача соперника',
        sections: [
          {
            title: 'Подача',
            actions: [
              { action: 'serve', result: 'neutral', quality: 'in_play', label: 'В игру', variant: 'neutral' },
              { action: 'serve', result: 'error', quality: 'serve_error', label: 'Ошиб', variant: 'error' },
            ],
          },
        ],
      }

    case 'reception':
      return {
        expectedTeamId: null,
        prompt: 'Приём соперника',
        sections: [
          {
            title: 'Приём',
            actions: [
              { action: 'reception', result: 'neutral', quality: 'positive', label: '+', variant: 'success' },
              { action: 'reception', result: 'neutral', quality: 'negative', label: '0', variant: 'neutral' },
              { action: 'reception', result: 'error', quality: 'reception_error', label: 'Ошиб', variant: 'error' },
            ],
          },
        ],
      }

    case 'in_play': {
      const awayBlockActions: ActionConfig[] = [
        { action: 'block', result: 'success', label: '+', variant: 'success' },
        { action: 'block', result: 'error', quality: 'block_error', label: '−', variant: 'error' },
      ]
      if (zone && isFrontRow(zone)) {
        awayBlockActions.push(
          { action: 'block', result: 'neutral', quality: 'soft', label: 'с', variant: 'neutral' },
          { action: 'block', result: 'neutral', quality: 'touch', label: '0', variant: 'neutral' },
        )
      }
      return {
        expectedTeamId: null,
        prompt: 'Действие соперника',
        sections: [
          {
            title: 'Атака',
            actions: [
              { action: 'attack', result: 'success', label: '+', variant: 'success' },
              { action: 'attack', result: 'neutral', quality: 'in_play', label: 'В игру', variant: 'neutral' },
              {
                action: 'attack', result: 'error', label: '−', variant: 'error',
                subOptions: [
                  { action: 'attack', result: 'error', quality: 'out_error', label: 'Аут', variant: 'error' },
                  { action: 'attack', result: 'error', quality: 'net_error', label: 'Другая ошибка', variant: 'error' },
                ],
              },
            ],
          },
          {
            title: 'Блок',
            actions: awayBlockActions,
          },
          {
            title: 'Защита',
            actions: [
              { action: 'defense', result: 'success', label: '+', variant: 'success' },
              { action: 'defense', result: 'error', quality: 'defense_error', label: '−', variant: 'error' },
            ],
          },
          {
            title: 'Перед',
            actions: [
              { action: 'defense', result: 'error', quality: 'setting_error', label: '−', variant: 'error' },
            ],
          },
        ],
      }
    }

    default:
      return {
        expectedTeamId: null,
        prompt: '',
        sections: [],
      }
  }
}

function findPointWinner(events: MatchEvent[], rally: RallyState): string | null {
  // Look at the last non-auto event to determine who scored
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.meta?.autoGenerated) continue

    if (e.result === 'success' && (e.action === 'serve' || e.action === 'attack' || e.action === 'block')) {
      return e.teamId
    }
    if (e.result === 'error') {
      // Error gives point to the other team
      return e.teamId === rally.servingTeamId ? rally.receivingTeamId : rally.servingTeamId
    }
  }
  return null
}
