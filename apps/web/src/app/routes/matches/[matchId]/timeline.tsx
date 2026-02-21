import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { useParams, Link } from 'react-router'
import type { MatchEvent, SpecialEvent, Rally } from '@volleystats/shared'
import { ACTION_LABELS } from '@volleystats/shared'
import { ArrowLeft, BarChart3, Clock, Timer } from 'lucide-react'
import { isAwayPlayerId, getAwayPlayerDisplayName } from '@/lib/awayPlayers'

function isMatchEvent(event: MatchEvent | SpecialEvent): event is MatchEvent {
  return 'action' in event
}

function isSpecialEvent(event: MatchEvent | SpecialEvent): event is SpecialEvent {
  return 'type' in event
}

// ─── Timeline Event Card ────────────────────────────────────────

function TimelineCard({
  event,
  playerName,
  playerNumber,
  isHome,
}: {
  event: MatchEvent
  playerName: string
  playerNumber: string
  isHome: boolean
}) {
  const isSuccess = event.result === 'success'
  const isError = event.result === 'error'
  const errorLabels: Record<string, string> = {
    serve_error: 'Ош.подачи',
    reception_error: 'Ош.приёма',
    attack_error: 'Ош.атаки',
    attack_blocked: 'Уд.в блок',
    block_error: 'Ош.блока',
    defense_error: 'Ош.защиты',
    setting_error: 'Ош.передачи',
  }
  const resultLabel = isError
    ? (event.meta?.quality && errorLabels[event.meta.quality]) || 'Ошибка'
    : ACTION_LABELS[event.action]

  return (
    <div
      className={cn(
        'rounded-xl p-3 backdrop-blur-md',
        'bg-white/[0.03] border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]',
        isHome ? 'border-r-4 border-r-primary' : 'border-l-4 border-l-pink-500',
      )}
    >
      <div className={cn('flex items-center gap-2.5', isHome ? 'flex-row-reverse' : 'flex-row')}>
        {/* Player badge */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg',
            isHome
              ? 'bg-primary shadow-primary/30'
              : 'bg-pink-500 shadow-pink-500/30',
          )}
        >
          {playerNumber}
        </div>
        <span className={cn('text-xs font-semibold text-slate-400', isHome ? 'text-right' : 'text-left')}>
          {playerName}
        </span>
      </div>
      <div className={cn('mt-2', isHome ? 'text-right' : 'text-left')}>
        <span
          className={cn(
            'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            isSuccess && 'bg-success/20 text-success',
            isError && 'bg-error/20 text-error',
            !isSuccess && !isError && 'bg-white/10 text-text-muted',
          )}
        >
          {resultLabel}
        </span>
      </div>
    </div>
  )
}

// ─── Score Pin ──────────────────────────────────────────────────

function ScorePin({ scoreHome, scoreAway, isHomePoint }: { scoreHome: number; scoreAway: number; isHomePoint: boolean }) {
  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <div
        className={cn(
          'rounded-full px-3 py-1 text-[11px] font-bold',
          'bg-background border',
          isHomePoint
            ? 'border-primary/40 text-primary shadow-[0_0_20px_rgba(60,131,246,0.4)]'
            : 'border-white/20 text-slate-300',
        )}
      >
        {scoreHome}:{scoreAway}
      </div>
    </div>
  )
}

// ─── Special Event Indicator ────────────────────────────────────

function SpecialEventIndicator({ event }: { event: SpecialEvent }) {
  const label =
    event.type === 'timeout'
      ? 'Тайм-аут'
      : event.type === 'substitution'
        ? 'Замена'
        : event.type === 'set_start'
          ? 'Начало сета'
          : event.type === 'set_end'
            ? 'Конец сета'
            : event.type

  return (
    <div className="relative flex justify-center py-4">
      <div className="flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-5 py-2">
        <Timer className="h-3.5 w-3.5 text-warning" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-warning">{label}</span>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export function MatchTimelinePage() {
  const { matchId } = useParams<{ matchId: string }>()

  const match = useLiveQuery(() => (matchId ? db.matches.get(matchId) : undefined), [matchId])
  const dbEvents = useLiveQuery(
    () =>
      matchId
        ? db.matchEvents.where('matchId').equals(matchId).sortBy('timestamp')
        : [],
    [matchId],
  ) ?? []
  const dbSpecialEvents = useLiveQuery(
    () =>
      matchId
        ? db.specialEvents.where('matchId').equals(matchId).sortBy('timestamp')
        : [],
    [matchId],
  ) ?? []

  const homeTeam = useLiveQuery(
    () => (match?.homeTeamId ? db.teams.get(match.homeTeamId) : undefined),
    [match?.homeTeamId],
  )
  const awayTeam = useLiveQuery(
    () => (match?.awayTeamId ? db.teams.get(match.awayTeamId) : undefined),
    [match?.awayTeamId],
  )

  const dbRallies = useLiveQuery(
    () =>
      matchId
        ? db.rallies.where('matchId').equals(matchId).sortBy('rallyNumber')
        : [],
    [matchId],
  ) ?? []

  const [selectedSet, setSelectedSet] = useState(1)

  const allEvents = useMemo(() => {
    return [...(dbEvents as (MatchEvent | SpecialEvent)[]), ...dbSpecialEvents].sort(
      (a, b) => a.timestamp - b.timestamp,
    )
  }, [dbEvents, dbSpecialEvents])

  const setEvents = useMemo(
    () => allEvents.filter((e) => e.setNumber === selectedSet),
    [allEvents, selectedSet],
  )

  // Player name + number lookup
  const playerInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; number: string }>()
    if (homeTeam) {
      homeTeam.players.forEach((p) => map.set(p.id, {
        name: p.lastName,
        number: String(p.number).padStart(2, '0'),
      }))
    }
    if (awayTeam) {
      awayTeam.players.forEach((p) => map.set(p.id, {
        name: p.lastName,
        number: String(p.number).padStart(2, '0'),
      }))
    }
    map.set('opponent-error', { name: 'Соперник', number: '??' })
    return map
  }, [homeTeam, awayTeam])

  const setRallies = useMemo(() => {
    return dbRallies.filter((r) => r.setNumber === selectedSet)
  }, [dbRallies, selectedSet])

  const rallyMap = useMemo(() => {
    const map = new Map<string, Rally>()
    for (const r of setRallies) map.set(r.id, r)
    return map
  }, [setRallies])

  // Build timeline data, filter out auto-generated events
  const timelineData = useMemo(() => {
    if (!match) return []
    return setEvents
      .filter((e) => {
        if (isMatchEvent(e) && e.meta?.autoGenerated) return false
        return true
      })
      .map((event) => {
        const teamId = event.teamId
        const isHome = teamId === match.homeTeamId
        let playerName = ''
        let playerNumber = '??'
        if (isMatchEvent(event)) {
          if (isAwayPlayerId(event.playerId)) {
            playerName = getAwayPlayerDisplayName(event.playerId)
            // Extract number from display name or use index
            const match2 = event.playerId.match(/\d+/)
            playerNumber = match2 ? match2[0].padStart(2, '0') : '??'
          } else {
            const info = playerInfoMap.get(event.playerId)
            playerName = info?.name ?? `#${event.playerId}`
            playerNumber = info?.number ?? '??'
          }
        }
        return { event, playerName, playerNumber, isHome }
      })
  }, [setEvents, match, playerInfoMap])

  // Available sets
  const availableSets = useMemo(() => {
    const sets = new Set<number>()
    allEvents.forEach((e) => sets.add(e.setNumber))
    if (sets.size === 0 && match) {
      match.sets.forEach((s) => sets.add(s.number))
    }
    return Array.from(sets).sort()
  }, [allEvents, match])

  if (!match) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-text-muted">Загрузка...</div>
      </div>
    )
  }

  const setsWonHome = match.sets.filter((s) => s.isFinished && s.scoreHome > s.scoreAway).length
  const setsWonAway = match.sets.filter((s) => s.isFinished && s.scoreAway > s.scoreHome).length

  return (
    <div className="px-4 pt-safe pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <Link to={`/matches/${matchId}/stats`} className="rounded-full p-2 hover:bg-surface-light">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <h1 className="flex-1 text-lg font-bold">Ход игры</h1>
      </div>

      {/* Set Tabs */}
      <div className="mb-5 flex gap-1 rounded-full bg-white/5 p-1">
        {availableSets.map((setNum) => (
          <button
            key={setNum}
            onClick={() => setSelectedSet(setNum)}
            className={cn(
              'flex-1 rounded-full px-3 py-2 text-xs font-medium transition',
              selectedSet === setNum
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            Сет {setNum}
          </button>
        ))}
      </div>

      {/* Team legend */}
      <div className="mb-8 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest opacity-60">
        <span className="text-primary">{homeTeam?.name ?? 'Хозяева'}</span>
        <span className="text-pink-500">{awayTeam?.name ?? 'Гости'}</span>
      </div>

      {/* Timeline */}
      <div className="relative max-w-lg mx-auto">
        {/* Central timeline line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[2px] pointer-events-none opacity-30"
          style={{
            background: 'linear-gradient(to bottom, rgba(60,131,246,0.1), rgba(60,131,246,0.8), rgba(60,131,246,0.1))',
            boxShadow: '0 0 15px rgba(60,131,246,0.5)',
          }}
        />

        {timelineData.length === 0 ? (
          <div className="glass py-12 text-center text-sm text-text-muted">
            Нет событий для этого сета
          </div>
        ) : (
          <div className="space-y-8 relative">
            {timelineData.map((data, idx) => {
              // Special events
              if (isSpecialEvent(data.event)) {
                return <SpecialEventIndicator key={data.event.id} event={data.event} />
              }

              const matchEvent = data.event as MatchEvent
              const isScoring = matchEvent.result === 'success' || matchEvent.result === 'error'

              // Determine previous score for score pin
              let showScorePin = false
              if (isScoring) {
                let prevScore = { home: 0, away: 0 }
                for (let j = idx - 1; j >= 0; j--) {
                  const prev = timelineData[j].event
                  if (isMatchEvent(prev)) {
                    prevScore = { home: prev.scoreHome, away: prev.scoreAway }
                    break
                  }
                }
                showScorePin = matchEvent.scoreHome !== prevScore.home || matchEvent.scoreAway !== prevScore.away
              }

              const isHomePoint = showScorePin && data.isHome && matchEvent.result === 'success'
                || showScorePin && !data.isHome && matchEvent.result === 'error'

              return (
                <div key={data.event.id} className="relative grid grid-cols-2 gap-6 items-center">
                  {/* Left (home) */}
                  <div className={cn('text-right', !data.isHome && 'invisible')}>
                    {data.isHome && (
                      <TimelineCard
                        event={matchEvent}
                        playerName={data.playerName}
                        playerNumber={data.playerNumber}
                        isHome={true}
                      />
                    )}
                  </div>

                  {/* Right (away) */}
                  <div className={cn('text-left', data.isHome && 'invisible')}>
                    {!data.isHome && (
                      <TimelineCard
                        event={matchEvent}
                        playerName={data.playerName}
                        playerNumber={data.playerNumber}
                        isHome={false}
                      />
                    )}
                  </div>

                  {/* Score pin */}
                  {showScorePin && (
                    <ScorePin
                      scoreHome={matchEvent.scoreHome}
                      scoreAway={matchEvent.scoreAway}
                      isHomePoint={isHomePoint}
                    />
                  )}
                </div>
              )
            })}

            {/* End marker */}
            <div className="text-center py-6">
              <span className="text-xs text-slate-500 font-medium tracking-widest uppercase">Начало сета</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="mt-6 flex gap-1 rounded-xl bg-surface-light p-1">
        <Link
          to={`/matches/${matchId}/stats`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium text-text-muted hover:text-text-secondary"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Статистика
        </Link>
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-medium text-white shadow-lg">
          <Clock className="h-3.5 w-3.5" />
          Ход игры
        </div>
      </div>
    </div>
  )
}

export default MatchTimelinePage;
