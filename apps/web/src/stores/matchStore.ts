import { create } from 'zustand'
import type { Match, MatchEvent, SpecialEvent, Rally, ActionType, ActionResult } from '@volleystats/shared'
import { db } from '@/db/database'
import {
  type RallyState,
  startRally,
  processAction,
  buildRallyRecord,
  rotateLineup,
  reverseRotateLineup,
  autoSwapLiberoOut,
  isSetWon,
  isTiebreakSet,
  generateId,
} from '@/lib/matchEngine'

interface MatchState {
  currentMatch: Match | null
  events: MatchEvent[]
  specialEvents: SpecialEvent[]
  rallies: Rally[]
  currentRally: RallyState | null
  rallyCount: number
  loading: boolean
  /** Temporary notification message (auto-libero swap, etc.) */
  notification: string | null

  // Data loading
  loadMatch: (matchId: string) => Promise<void>
  updateMatch: (match: Match) => Promise<void>

  // Legacy (kept for backward compat)
  addEvent: (event: MatchEvent) => Promise<void>
  undoLastEvent: () => Promise<void>

  // Rally-based flow
  beginRally: () => void
  executeRallyAction: (
    action: ActionType,
    result: ActionResult,
    playerId: string,
    teamId: string,
    quality?: string,
  ) => Promise<void>
  cancelRally: () => void
  undoLastRallyAction: () => Promise<void>
  undoLastRally: () => Promise<void>

  // Special events
  addSpecialEvent: (event: SpecialEvent) => Promise<void>

  // Notifications
  clearNotification: () => void
}

export const useMatchStore = create<MatchState>((set, get) => ({
  currentMatch: null,
  events: [],
  specialEvents: [],
  rallies: [],
  currentRally: null,
  rallyCount: 0,
  loading: false,
  notification: null,

  loadMatch: async (matchId) => {
    set({ loading: true })
    const match = await db.matches.get(matchId)
    const events = await db.matchEvents.where('matchId').equals(matchId).sortBy('timestamp')
    const specialEvents = await db.specialEvents.where('matchId').equals(matchId).sortBy('timestamp')
    const rallies = await db.rallies.where('matchId').equals(matchId).sortBy('timestamp')

    // Count rallies in current set
    const currentSet = match?.currentSet ?? 1
    const setRallies = rallies.filter((r) => r.setNumber === currentSet)

    set({
      currentMatch: match ?? null,
      events,
      specialEvents,
      rallies,
      rallyCount: setRallies.length,
      currentRally: null,
      loading: false,
    })
  },

  updateMatch: async (match) => {
    const updated = { ...match, updatedAt: new Date().toISOString() }
    await db.matches.put(updated)
    set({ currentMatch: updated })
  },

  addEvent: async (event) => {
    await db.matchEvents.add(event)
    set((state) => ({ events: [...state.events, event] }))
  },

  undoLastEvent: async () => {
    const { events } = get()
    if (events.length === 0) return
    const last = events[events.length - 1]
    await db.matchEvents.delete(last.id)
    set((state) => ({ events: state.events.slice(0, -1) }))
  },

  // ─── Rally Flow ─────────────────────────────────────────────

  beginRally: () => {
    const { currentMatch, rallyCount } = get()
    if (!currentMatch) return

    // Get current set score from match
    const currentSetData = currentMatch.sets.find((s) => s.number === currentMatch.currentSet)
    const scoreHome = currentSetData?.scoreHome ?? 0
    const scoreAway = currentSetData?.scoreAway ?? 0

    const rally = startRally(currentMatch, rallyCount + 1, scoreHome, scoreAway)
    set({ currentRally: rally })
  },

  executeRallyAction: async (action, result, playerId, teamId, quality) => {
    const { currentMatch, currentRally, events, rallyCount } = get()
    if (!currentMatch || !currentRally) return

    const outcome = processAction(currentRally, currentMatch, action, result, playerId, teamId, quality)

    // Persist new events
    for (const event of outcome.newEvents) {
      await db.matchEvents.add(event)
    }

    // Persist retroactively updated events (e.g., opponent serve quality from reception)
    for (const event of outcome.updatedEvents) {
      await db.matchEvents.put(event)
    }

    // Apply updates to rally events: replace old versions with updated ones
    const updatedIds = new Set(outcome.updatedEvents.map((e) => e.id))
    const mergedPrevEvents = currentRally.events.map(
      (e) => outcome.updatedEvents.find((u) => u.id === e.id) || e,
    )
    const allRallyEvents = [...mergedPrevEvents, ...outcome.newEvents]
    const updatedRally: RallyState = {
      ...currentRally,
      phase: outcome.newPhase,
      events: allRallyEvents,
    }

    // Update score in match sets
    const lastEvent = outcome.newEvents[outcome.newEvents.length - 1]
    if (lastEvent) {
      const updatedSets = currentMatch.sets.map((s) =>
        s.number === currentMatch.currentSet
          ? { ...s, scoreHome: lastEvent.scoreHome, scoreAway: lastEvent.scoreAway }
          : s,
      )
      const updatedMatch = { ...currentMatch, sets: updatedSets, updatedAt: new Date().toISOString() }

      if (outcome.rallyComplete) {
        // Build and persist rally record
        const rallyRecord = buildRallyRecord(updatedRally, allRallyEvents, currentMatch.id, rallyCount + 1)
        await db.rallies.add(rallyRecord)

        // Handle side-out: rotate + switch serving team
        let finalMatch = updatedMatch
        const autoSwapEvents: SpecialEvent[] = []
        let notificationMsg: string | null = null

        if (outcome.sideOut) {
          const newServingTeamId = currentRally.receivingTeamId
          const isHomeRotating = newServingTeamId === currentMatch.homeTeamId
          const teamToRotateLineup = isHomeRotating
            ? updatedMatch.homeLineup
            : updatedMatch.awayLineup

          let rotatedLineup = rotateLineup(teamToRotateLineup)

          if (isHomeRotating) {
            // Check if libero needs auto swap-out after rotation
            const liberoIds = currentMatch.homeLiberoIds && currentMatch.homeLiberoIds.length > 0
              ? currentMatch.homeLiberoIds
              : currentMatch.homeLiberoId ? [currentMatch.homeLiberoId] : []

            const replacements = currentMatch.homeLiberoReplacements
              || (currentMatch.homeLiberoId && currentMatch.homeLiberoReplacedPlayerId
                ? { [currentMatch.homeLiberoId]: currentMatch.homeLiberoReplacedPlayerId }
                : {})

            const autoSwap = autoSwapLiberoOut(rotatedLineup, liberoIds, replacements, true)

            if (autoSwap.swappedOut.length > 0) {
              rotatedLineup = autoSwap.lineup

              // Create special events for each libero swapped out
              for (const liberoId of autoSwap.swappedOut) {
                const replacedPlayerId = replacements[liberoId]
                autoSwapEvents.push({
                  id: generateId(),
                  matchId: currentMatch.id,
                  setNumber: currentMatch.currentSet,
                  timestamp: Date.now(),
                  teamId: currentMatch.homeTeamId,
                  type: 'libero_out',
                  meta: { playerIn: replacedPlayerId, playerOut: liberoId, description: 'auto' },
                })
              }

              notificationMsg = 'Либеро автоматически заменён (не может подавать / передняя линия)'

              finalMatch = {
                ...finalMatch,
                homeLineup: rotatedLineup,
                servingTeamId: newServingTeamId,
                homeLiberoReplacements: Object.keys(autoSwap.replacements).length > 0
                  ? autoSwap.replacements
                  : undefined,
                homeLiberoReplacedPlayerId: currentMatch.homeLiberoId && autoSwap.swappedOut.includes(currentMatch.homeLiberoId)
                  ? undefined
                  : currentMatch.homeLiberoReplacedPlayerId,
              }
            } else {
              finalMatch = { ...finalMatch, homeLineup: rotatedLineup, servingTeamId: newServingTeamId }
            }
          } else {
            finalMatch = { ...finalMatch, awayLineup: rotatedLineup, servingTeamId: newServingTeamId }
          }
        }

        // Persist special events for auto libero swaps
        for (const se of autoSwapEvents) {
          await db.specialEvents.add(se)
        }

        await db.matches.put(finalMatch)
        // Merge updated + new events into state
        const mergedEvents = events.map((e) => updatedIds.has(e.id) ? outcome.updatedEvents.find((u) => u.id === e.id)! : e)
        set({
          currentMatch: finalMatch,
          events: [...mergedEvents, ...outcome.newEvents],
          specialEvents: [...get().specialEvents, ...autoSwapEvents],
          rallies: [...get().rallies, rallyRecord],
          currentRally: null,
          rallyCount: rallyCount + 1,
          notification: notificationMsg,
        })
      } else {
        // Rally continues
        await db.matches.put(updatedMatch)
        const mergedEvents = events.map((e) => updatedIds.has(e.id) ? outcome.updatedEvents.find((u) => u.id === e.id)! : e)
        set({
          currentMatch: updatedMatch,
          events: [...mergedEvents, ...outcome.newEvents],
          currentRally: updatedRally,
        })
      }
    }
  },

  cancelRally: () => {
    // Cancel current rally, remove any events already added
    const { currentRally, events } = get()
    if (!currentRally) return

    const rallyEventIds = new Set(currentRally.events.map((e) => e.id))
    // Delete rally events from DB
    for (const id of rallyEventIds) {
      db.matchEvents.delete(id)
    }

    set({
      currentRally: null,
      events: events.filter((e) => !rallyEventIds.has(e.id)),
    })
  },

  undoLastRallyAction: async () => {
    const { currentRally, events, currentMatch } = get()
    if (!currentRally || currentRally.events.length === 0 || !currentMatch) return

    // Remove the last event (and any auto-generated companion)
    const eventsToRemove: string[] = []
    const rallyEvents = [...currentRally.events]

    // Remove last event
    const lastEvent = rallyEvents.pop()!
    eventsToRemove.push(lastEvent.id)

    // If the last event was auto-generated, also remove the one before it
    if (lastEvent.meta?.autoGenerated && rallyEvents.length > 0) {
      const prevEvent = rallyEvents.pop()!
      eventsToRemove.push(prevEvent.id)
    }

    // Delete from DB
    for (const id of eventsToRemove) {
      await db.matchEvents.delete(id)
    }

    // Determine new phase
    let newPhase = currentRally.phase
    if (rallyEvents.length === 0) {
      newPhase = 'serve'
    } else {
      const lastRemaining = rallyEvents[rallyEvents.length - 1]
      if (lastRemaining.action === 'serve') {
        newPhase = 'reception'
      } else if (lastRemaining.action === 'reception') {
        newPhase = 'in_play'
      } else {
        newPhase = 'in_play'
      }
    }

    // Restore score from before removed events
    const prevScore = rallyEvents.length > 0
      ? { home: rallyEvents[rallyEvents.length - 1].scoreHome, away: rallyEvents[rallyEvents.length - 1].scoreAway }
      : { home: currentRally.scoreHomeBefore, away: currentRally.scoreAwayBefore }

    const updatedSets = currentMatch.sets.map((s) =>
      s.number === currentMatch.currentSet
        ? { ...s, scoreHome: prevScore.home, scoreAway: prevScore.away }
        : s,
    )
    const updatedMatch = { ...currentMatch, sets: updatedSets, updatedAt: new Date().toISOString() }
    await db.matches.put(updatedMatch)

    set({
      currentRally: { ...currentRally, phase: newPhase, events: rallyEvents },
      events: events.filter((e) => !eventsToRemove.includes(e.id)),
      currentMatch: updatedMatch,
    })
  },

  undoLastRally: async () => {
    const { currentMatch, events, rallies, specialEvents, rallyCount } = get()
    if (!currentMatch || rallies.length === 0) return

    // Find last rally in current set
    const setRallies = rallies.filter((r) => r.setNumber === currentMatch.currentSet)
    if (setRallies.length === 0) return
    const lastRally = setRallies[setRallies.length - 1]

    // Delete rally events from DB
    const rallyEventIds = events.filter((e) => e.rallyId === lastRally.id).map((e) => e.id)
    for (const id of rallyEventIds) {
      await db.matchEvents.delete(id)
    }
    await db.rallies.delete(lastRally.id)

    // Restore score
    let restoredMatch: Match = {
      ...currentMatch,
      sets: currentMatch.sets.map((s) =>
        s.number === currentMatch.currentSet
          ? { ...s, scoreHome: lastRally.scoreHomeBefore, scoreAway: lastRally.scoreAwayBefore }
          : s,
      ),
    }

    // Detect side-out: point won by receiving team
    const wasSideOut =
      lastRally.pointWonByTeamId !== null &&
      lastRally.pointWonByTeamId !== lastRally.servingTeamId

    if (wasSideOut) {
      // Restore serving team
      restoredMatch.servingTeamId = lastRally.servingTeamId

      // Reverse rotation on the team that was rotated (= team that won the point = new serving team)
      const rotatedTeamIsHome = lastRally.pointWonByTeamId === currentMatch.homeTeamId

      if (rotatedTeamIsHome) {
        restoredMatch.homeLineup = reverseRotateLineup(currentMatch.homeLineup)

        // Undo auto-libero swaps: find libero_out events with 'auto' description after rally timestamp
        const autoLiberoEvents = specialEvents.filter(
          (se) =>
            se.type === 'libero_out' &&
            se.meta?.description === 'auto' &&
            se.setNumber === currentMatch.currentSet &&
            se.timestamp >= lastRally.timestamp - 1000,
        )

        if (autoLiberoEvents.length > 0) {
          let lineup = restoredMatch.homeLineup
          const replacements = { ...(currentMatch.homeLiberoReplacements || {}) }

          for (const event of autoLiberoEvents) {
            const liberoId = event.meta!.playerOut!
            const replacedPlayerId = event.meta!.playerIn!

            // Put libero back on court
            lineup = lineup.map((e) =>
              e.playerId === replacedPlayerId
                ? { ...e, playerId: liberoId, isLibero: true }
                : e,
            )
            replacements[liberoId] = replacedPlayerId

            await db.specialEvents.delete(event.id)
          }

          restoredMatch.homeLineup = lineup
          restoredMatch.homeLiberoReplacements =
            Object.keys(replacements).length > 0 ? replacements : undefined

          // Restore legacy field if first libero was swapped out
          if (currentMatch.homeLiberoId) {
            const firstLiberoEvent = autoLiberoEvents.find(
              (e) => e.meta?.playerOut === currentMatch.homeLiberoId,
            )
            if (firstLiberoEvent) {
              restoredMatch.homeLiberoReplacedPlayerId = firstLiberoEvent.meta!.playerIn!
            }
          }
        }
      } else {
        restoredMatch.awayLineup = reverseRotateLineup(currentMatch.awayLineup)
      }
    }

    restoredMatch.updatedAt = new Date().toISOString()
    await db.matches.put(restoredMatch)

    // Remove auto-libero events from state
    const autoEventIds = new Set(
      specialEvents
        .filter(
          (se) =>
            se.type === 'libero_out' &&
            se.meta?.description === 'auto' &&
            se.setNumber === currentMatch.currentSet &&
            se.timestamp >= lastRally.timestamp - 1000,
        )
        .map((se) => se.id),
    )

    set({
      currentMatch: restoredMatch,
      events: events.filter((e) => e.rallyId !== lastRally.id),
      rallies: rallies.filter((r) => r.id !== lastRally.id),
      specialEvents: specialEvents.filter((se) => !autoEventIds.has(se.id)),
      rallyCount: rallyCount - 1,
      notification: `Розыгрыш #${lastRally.rallyNumber} отменён`,
    })
  },

  addSpecialEvent: async (event) => {
    await db.specialEvents.add(event)
    set((state) => ({ specialEvents: [...state.specialEvents, event] }))
  },

  clearNotification: () => set({ notification: null }),
}))
