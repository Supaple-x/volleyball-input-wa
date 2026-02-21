import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { useMatchStore } from '@/stores/matchStore'
import type { ActionType, ActionResult, RallyPhase, MatchSet, LineupEntry, Match, Team } from '@volleystats/shared'
import { VOLLEYBALL_RULES } from '@volleystats/shared'
import {
  isSetWon,
  isTiebreakSet,
  countSetsWon,
  generateId,
  getLiberoEligiblePlayers,
  getServer,
} from '@/lib/matchEngine'
import { isAwayPlayerId, generateAwayLineup } from '@/lib/awayPlayers'

import { ScoreBar } from '@/components/live/ScoreBar'
import { DualCourtView } from '@/components/live/DualCourtView'
import { EventFeed } from '@/components/live/EventFeed'
import { SetupLineupModal } from '@/components/live/SetupLineupModal'
import { Undo2, Menu, X } from 'lucide-react'

// ─── End Set Modal ──────────────────────────────────────────────

function EndSetModal({
  onConfirm,
  onCancel,
  scoreHome,
  scoreAway,
  setNumber,
}: {
  onConfirm: () => void
  onCancel: () => void
  scoreHome: number
  scoreAway: number
  setNumber: number
}) {
  const winner = scoreHome > scoreAway ? 'Хозяева' : 'Гости'
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl glass-light p-6 text-center">
        <h3 className="mb-3 text-base font-bold">Завершить сет {setNumber}?</h3>
        <div className="mb-4 flex items-center justify-center gap-4 text-3xl font-black">
          <span>{scoreHome}</span>
          <span className="text-text-muted">:</span>
          <span>{scoreAway}</span>
        </div>
        <p className="mb-6 text-sm text-text-muted">Победитель: {winner}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-light">
            Отмена
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-error py-3 text-sm font-bold text-white transition active:scale-[0.98]">
            Завершить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Side Menu ──────────────────────────────────────────────────

function SideMenu({
  onClose,
  onTimeout,
  match,
}: {
  onClose: () => void
  onTimeout: (team: 'home' | 'away') => void
  match: { homeTimeouts: number; awayTimeouts: number }
}) {
  const maxTO = VOLLEYBALL_RULES.MAX_TIMEOUTS_PER_SET
  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="ml-auto w-64 h-full bg-surface border-l border-border p-4 pt-safe overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider">Меню</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-light">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Таймауты</h4>
          <button
            onClick={() => onTimeout('home')}
            disabled={match.homeTimeouts >= maxTO}
            className={cn(
              'w-full rounded-xl border border-border px-4 py-3 text-left text-sm transition active:scale-[0.98]',
              match.homeTimeouts >= maxTO ? 'opacity-40' : 'hover:bg-surface-light',
            )}
          >
            Хозяева ({match.homeTimeouts}/{maxTO})
          </button>
          <button
            onClick={() => onTimeout('away')}
            disabled={match.awayTimeouts >= maxTO}
            className={cn(
              'w-full rounded-xl border border-border px-4 py-3 text-left text-sm transition active:scale-[0.98]',
              match.awayTimeouts >= maxTO ? 'opacity-40' : 'hover:bg-surface-light',
            )}
          >
            Гости ({match.awayTimeouts}/{maxTO})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Libero Control ─────────────────────────────────────────────

function getLiberoIds(match: Match): string[] {
  if (match.homeLiberoIds && match.homeLiberoIds.length > 0) return match.homeLiberoIds
  if (match.homeLiberoId) return [match.homeLiberoId]
  return []
}

function getLiberoReplacements(match: Match): Record<string, string> {
  if (match.homeLiberoReplacements) return match.homeLiberoReplacements
  if (match.homeLiberoId && match.homeLiberoReplacedPlayerId) {
    return { [match.homeLiberoId]: match.homeLiberoReplacedPlayerId }
  }
  return {}
}

function LiberoControl({
  match,
  homeTeam,
  onSwapIn,
  onSwapOut,
}: {
  match: Match
  homeTeam: Team | undefined
  onSwapIn: (liberoId: string, replacedPlayerId: string) => void
  onSwapOut: (liberoId: string) => void
}) {
  const [pickerForLibero, setPickerForLibero] = useState<string | null>(null)

  const liberoIds = getLiberoIds(match)
  if (liberoIds.length === 0 || !homeTeam) return null

  const replacements = getLiberoReplacements(match)
  const eligiblePlayers = getLiberoEligiblePlayers(match.homeLineup)
    .map((entry) => ({
      entry,
      player: homeTeam.players.find((p) => p.id === entry.playerId),
    }))
    .filter(({ player }) => !!player)

  return (
    <div className="mx-3 space-y-2">
      {liberoIds.map((liberoId) => {
        const liberoPlayer = homeTeam.players.find((p) => p.id === liberoId)
        if (!liberoPlayer) return null

        const isOnCourt = match.homeLineup.some((e) => e.playerId === liberoId)
        const showPicker = pickerForLibero === liberoId

        return (
          <div key={liberoId} className="rounded-xl border border-success/30 bg-success/5 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-success font-semibold">Либеро</span>
                <span className="text-xs text-text-secondary">
                  #{liberoPlayer.number} {liberoPlayer.lastName}
                </span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  isOnCourt ? 'bg-success/20 text-success' : 'bg-text-muted/20 text-text-muted',
                )}>
                  {isOnCourt ? 'на площадке' : 'скамейка'}
                </span>
              </div>

              {isOnCourt ? (
                <button
                  onClick={() => onSwapOut(liberoId)}
                  className="rounded-lg border border-error/30 bg-error/10 px-3 py-1.5 text-[11px] font-semibold text-error active:scale-95"
                >
                  Убрать
                </button>
              ) : (
                <button
                  onClick={() => setPickerForLibero(showPicker ? null : liberoId)}
                  className="rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-[11px] font-semibold text-success active:scale-95"
                >
                  На площадку
                </button>
              )}
            </div>

            {showPicker && !isOnCourt && eligiblePlayers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="w-full text-[10px] text-text-muted">Заменить игрока:</span>
                {eligiblePlayers.map(({ entry, player }) => (
                  <button
                    key={entry.playerId}
                    onClick={() => {
                      onSwapIn(liberoId, entry.playerId)
                      setPickerForLibero(null)
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-light px-2.5 py-1.5 text-xs active:scale-95"
                  >
                    <span className="font-bold text-primary">#{player!.number}</span>
                    <span className="text-text-secondary">{player!.lastName}</span>
                    <span className="text-[10px] text-text-muted">з.{entry.zone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export function LiveMatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()

  const {
    loadMatch,
    updateMatch,
    currentMatch: match,
    events,
    loading,
    currentRally,
    beginRally,
    executeRallyAction,
    cancelRally,
    undoLastRallyAction,
    addSpecialEvent,
    notification,
    clearNotification,
  } = useMatchStore()

  const homeTeam = useLiveQuery(() =>
    match?.homeTeamId ? db.teams.get(match.homeTeamId) : undefined,
    [match?.homeTeamId],
  )
  const awayTeam = useLiveQuery(() =>
    match?.awayTeamId ? db.teams.get(match.awayTeamId) : undefined,
    [match?.awayTeamId],
  )

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showEndSetModal, setShowEndSetModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSetupLineup, setShowSetupLineup] = useState(false)

  useEffect(() => {
    if (matchId) loadMatch(matchId)
  }, [matchId, loadMatch])

  // Auto-populate awayLineup for old matches
  useEffect(() => {
    if (match && match.awayLineup.length === 0) {
      const awayLineup = generateAwayLineup()
      updateMatch({ ...match, awayLineup, awayLiberoIds: ['away-l1', 'away-l2'] })
    }
  }, [match?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss store notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 4000)
      return () => clearTimeout(timer)
    }
  }, [notification, clearNotification])

  const currentSetScore = useMemo(() => {
    if (!match) return { home: 0, away: 0 }
    const set = match.sets.find((s) => s.number === match.currentSet)
    return { home: set?.scoreHome ?? 0, away: set?.scoreAway ?? 0 }
  }, [match])

  const rallyPhase: RallyPhase = currentRally?.phase ?? 'idle'
  const servingTeamId = currentRally?.servingTeamId ?? match?.servingTeamId ?? match?.homeTeamId ?? ''
  const receivingTeamId = servingTeamId === match?.homeTeamId ? match?.awayTeamId ?? '' : match?.homeTeamId ?? ''

  const expectedTeamId = useMemo(() => {
    if (rallyPhase === 'serve') return servingTeamId
    if (rallyPhase === 'reception') return receivingTeamId
    return null
  }, [rallyPhase, servingTeamId, receivingTeamId])

  const setIsWon = useMemo(() => {
    if (!match) return false
    return isSetWon(currentSetScore.home, currentSetScore.away, isTiebreakSet(match.currentSet))
  }, [currentSetScore, match])

  // ─── Handlers ─────────────────────────────────────────────

  const handleSelectPlayer = useCallback((playerId: string, teamId: string) => {
    setSelectedPlayerId((prev) => prev === playerId ? null : playerId)
    setSelectedTeamId(teamId)
  }, [])

  /** Contextual action: player + action in one step. */
  const handlePlayerAction = useCallback(async (
    playerId: string,
    teamId: string,
    action: ActionType,
    result: ActionResult,
    quality?: string,
  ) => {
    if (!match) return

    if (!currentRally) {
      beginRally()
      setTimeout(() => {
        executeRallyAction(action, result, playerId, teamId, quality)
      }, 0)
    } else {
      await executeRallyAction(action, result, playerId, teamId, quality)
    }

    // Deselect after action
    setSelectedPlayerId(null)
    setSelectedTeamId(null)
  }, [match, currentRally, beginRally, executeRallyAction])

  const handleOpponentError = useCallback(async () => {
    if (!match) return
    const ourTeamId = selectedTeamId || match.homeTeamId

    if (!currentRally) {
      beginRally()
      setTimeout(async () => {
        await executeRallyAction('defense', 'success', 'opponent-error', ourTeamId)
      }, 0)
    } else {
      await executeRallyAction('defense', 'success', 'opponent-error', ourTeamId)
    }

    setSelectedPlayerId(null)
    setSelectedTeamId(null)
  }, [match, currentRally, selectedTeamId, beginRally, executeRallyAction])

  const handleUndo = useCallback(async () => {
    if (currentRally && currentRally.events.length > 0) {
      await undoLastRallyAction()
    } else if (currentRally && currentRally.events.length === 0) {
      cancelRally()
    }
  }, [currentRally, undoLastRallyAction, cancelRally])

  const handleEndSet = useCallback(async () => {
    if (!match) return

    const sets = match.sets.map((s) =>
      s.number === match.currentSet ? { ...s, isFinished: true } : s,
    )

    const { home: setsHome, away: setsAway } = countSetsWon(sets)

    if (setsHome >= VOLLEYBALL_RULES.SETS_TO_WIN || setsAway >= VOLLEYBALL_RULES.SETS_TO_WIN) {
      await updateMatch({ ...match, sets, status: 'finished' })
      navigate(`/matches/${match.id}/stats`)
    } else {
      const nextSet = match.currentSet + 1
      const newSetData: MatchSet = {
        number: nextSet,
        scoreHome: 0,
        scoreAway: 0,
        isFinished: false,
      }

      await updateMatch({
        ...match,
        sets: [...sets, newSetData],
        currentSet: nextSet,
        homeTimeouts: 0,
        awayTimeouts: 0,
        homeSubstitutions: 0,
        awaySubstitutions: 0,
      })

      setShowEndSetModal(false)
      setShowSetupLineup(true)
      setSelectedPlayerId(null)
      setSelectedTeamId(null)
    }
  }, [match, updateMatch, navigate])

  const handleSetupLineupConfirm = useCallback(async (homeLineup: LineupEntry[]) => {
    if (!match) return

    const newServingTeamId = match.firstServeTeamId
      ? (match.currentSet % 2 === 1 ? match.firstServeTeamId : (match.firstServeTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId))
      : match.homeTeamId

    const newAwayLineup = generateAwayLineup()

    const setLineups = [...(match.setLineups || []), {
      setNumber: match.currentSet,
      homeLineup,
      awayLineup: newAwayLineup,
    }]

    await updateMatch({
      ...match,
      homeLineup,
      awayLineup: newAwayLineup,
      setLineups,
      servingTeamId: newServingTeamId,
    })

    setShowSetupLineup(false)
  }, [match, updateMatch])

  const handleTimeout = useCallback(async (team: 'home' | 'away') => {
    if (!match) return
    const updated = team === 'home'
      ? { ...match, homeTimeouts: match.homeTimeouts + 1 }
      : { ...match, awayTimeouts: match.awayTimeouts + 1 }
    await updateMatch(updated)

    await addSpecialEvent({
      id: generateId(),
      matchId: match.id,
      setNumber: match.currentSet,
      timestamp: Date.now(),
      teamId: team === 'home' ? match.homeTeamId : match.awayTeamId,
      type: 'timeout',
    })

    setShowMenu(false)
  }, [match, updateMatch, addSpecialEvent])

  const handleLiberoIn = useCallback(async (liberoId: string, replacedPlayerId: string) => {
    if (!match) return

    const newLineup = match.homeLineup.map((e) =>
      e.playerId === replacedPlayerId
        ? { ...e, playerId: liberoId, isLibero: true }
        : e,
    )

    const prevReplacements = getLiberoReplacements(match)
    const newReplacements = { ...prevReplacements, [liberoId]: replacedPlayerId }

    await updateMatch({
      ...match,
      homeLineup: newLineup,
      homeLiberoReplacements: newReplacements,
      homeLiberoReplacedPlayerId: liberoId === match.homeLiberoId ? replacedPlayerId : match.homeLiberoReplacedPlayerId,
    })

    await addSpecialEvent({
      id: generateId(),
      matchId: match.id,
      setNumber: match.currentSet,
      timestamp: Date.now(),
      teamId: match.homeTeamId,
      type: 'libero_in',
      meta: { playerIn: liberoId, playerOut: replacedPlayerId },
    })
  }, [match, updateMatch, addSpecialEvent])

  const handleLiberoOut = useCallback(async (liberoId: string) => {
    if (!match) return

    const replacements = getLiberoReplacements(match)
    const replacedPlayerId = replacements[liberoId]
    if (!replacedPlayerId) return

    const newLineup = match.homeLineup.map((e) =>
      e.playerId === liberoId
        ? { ...e, playerId: replacedPlayerId, isLibero: false }
        : e,
    )

    const newReplacements = { ...replacements }
    delete newReplacements[liberoId]

    await updateMatch({
      ...match,
      homeLineup: newLineup,
      homeLiberoReplacements: Object.keys(newReplacements).length > 0 ? newReplacements : undefined,
      homeLiberoReplacedPlayerId: liberoId === match.homeLiberoId ? undefined : match.homeLiberoReplacedPlayerId,
    })

    await addSpecialEvent({
      id: generateId(),
      matchId: match.id,
      setNumber: match.currentSet,
      timestamp: Date.now(),
      teamId: match.homeTeamId,
      type: 'libero_out',
      meta: { playerIn: replacedPlayerId, playerOut: liberoId },
    })
  }, [match, updateMatch, addSpecialEvent])

  // ─── Loading / Error ──────────────────────────────────────

  if (loading || !match) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Score Bar */}
      <ScoreBar
        match={match}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        currentSetScore={currentSetScore}
        rallyPhase={rallyPhase}
        servingTeamId={match.servingTeamId}
        events={events.filter(e => e.setNumber === match.currentSet)}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-24 space-y-3 pt-3">
        {/* Dual Court View with popover actions on circles */}
        <DualCourtView
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeLineup={match.homeLineup}
          awayLineup={match.awayLineup}
          selectedPlayerId={selectedPlayerId}
          expectedTeamId={expectedTeamId}
          rallyPhase={rallyPhase}
          servingTeamId={servingTeamId}
          receivingTeamId={receivingTeamId}
          onSelectPlayer={handleSelectPlayer}
          onPlayerAction={handlePlayerAction}
        />

        {/* Libero Control */}
        <LiberoControl
          match={match}
          homeTeam={homeTeam}
          onSwapIn={handleLiberoIn}
          onSwapOut={handleLiberoOut}
        />

        {/* Start Rally button (when idle) */}
        {rallyPhase === 'idle' && !currentRally && match.status === 'live' && !setIsWon && (
          <div className="px-3 space-y-2">
            <button
              onClick={() => {
                beginRally()
                if (servingTeamId === match.homeTeamId) {
                  const serverEntry = match.homeLineup.find((e) => e.zone === 1)
                  if (serverEntry) {
                    setSelectedPlayerId(serverEntry.playerId)
                    setSelectedTeamId(servingTeamId)
                  }
                } else {
                  const awayServer = getServer(match.awayLineup)
                  if (awayServer) {
                    setSelectedPlayerId(awayServer.playerId)
                    setSelectedTeamId(match.awayTeamId)
                  } else {
                    setSelectedPlayerId(null)
                    setSelectedTeamId(null)
                  }
                }
              }}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition active:scale-[0.98]"
            >
              Начать розыгрыш
            </button>
            <button
              onClick={handleOpponentError}
              className="w-full rounded-xl border border-warning/40 bg-warning/10 py-2.5 text-xs font-semibold text-warning transition active:scale-[0.98] active:bg-warning/20"
            >
              Ошибка соперника +1
            </button>
          </div>
        )}

        {/* Opponent error button during in_play */}
        {rallyPhase === 'in_play' && (
          <div className="px-3">
            <button
              onClick={handleOpponentError}
              className="w-full rounded-xl border border-warning/30 bg-warning/10 py-2 text-[11px] font-semibold text-warning transition-all active:scale-[0.98]"
            >
              Ошибка соперника +1
            </button>
          </div>
        )}

        {/* Event Feed */}
        <EventFeed
          events={events.filter((e) => e.setNumber === match.currentSet)}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeTeamId={match.homeTeamId}
        />
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-border bg-background/90 px-4 py-2 pb-safe backdrop-blur-xl">
        <button
          onClick={handleUndo}
          disabled={!currentRally || currentRally.events.length === 0}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full glass transition-all active:scale-95',
            (!currentRally || currentRally.events.length === 0) && 'opacity-30',
          )}
        >
          <Undo2 size={20} className="text-text-secondary" />
        </button>

        {setIsWon && !currentRally ? (
          <button
            onClick={() => setShowEndSetModal(true)}
            className="rounded-full bg-error px-6 py-3 text-sm font-bold text-white shadow-lg shadow-error/30 transition active:scale-[0.98]"
          >
            Завершить сет
          </button>
        ) : (
          <div className="text-xs text-text-muted">
            {currentRally ? `Розыгрыш · ${currentRally.events.length} действий` : ''}
          </div>
        )}

        <button
          onClick={() => setShowMenu(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full glass transition-all active:scale-95"
        >
          <Menu size={20} className="text-text-secondary" />
        </button>
      </div>

      {/* Modals */}
      {showEndSetModal && (
        <EndSetModal
          onConfirm={handleEndSet}
          onCancel={() => setShowEndSetModal(false)}
          scoreHome={currentSetScore.home}
          scoreAway={currentSetScore.away}
          setNumber={match.currentSet}
        />
      )}

      {showMenu && (
        <SideMenu
          onClose={() => setShowMenu(false)}
          onTimeout={handleTimeout}
          match={match}
        />
      )}

      {showSetupLineup && homeTeam && (
        <SetupLineupModal
          homeTeam={homeTeam}
          setNumber={match.currentSet}
          previousHomeLineup={match.homeLineup}
          onConfirm={handleSetupLineupConfirm}
          onCancel={() => setShowSetupLineup(false)}
        />
      )}

      {/* Toast notification */}
      {notification && (
        <div
          className="fixed top-20 left-1/2 z-[100] -translate-x-1/2"
          style={{ animation: 'toast-in 0.3s ease-out' }}
        >
          <div
            className="flex items-center gap-2 rounded-xl border border-warning/30 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur-lg"
            onClick={clearNotification}
          >
            <span className="text-warning text-sm">&#x27F3;</span>
            <span className="text-xs font-medium text-text-secondary">{notification}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveMatchPage;
