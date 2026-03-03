import { useMemo } from 'react'
import type { MatchEvent, Team, LineupEntry } from '@volleystats/shared'
import { ACTION_LABELS } from '@volleystats/shared'
import { cn } from '@/lib/utils'
import { isAwayPlayerId, getAwayPlayerDisplayName } from '@/lib/awayPlayers'

// ─── Result label ────────────────────────────────────────────────

function getResultLabel(event: MatchEvent): { label: string; variant: 'success' | 'error' | 'neutral' | 'point' } {
  const q = event.meta?.quality
  const result = event.result

  const QUALITY_MAP: Record<string, { label: string; variant: 'success' | 'error' | 'neutral' | 'point' }> = {
    ace:            { label: 'Эйс',           variant: 'success' },
    pressure:       { label: 'Услож',         variant: 'neutral' },
    in_play:        { label: 'В игру',        variant: 'neutral' },
    serve_error:    { label: 'Ошиб. подачи', variant: 'error'   },
    excellent:      { label: '++',            variant: 'success' },
    positive:       { label: '+',             variant: 'success' },
    ok:             { label: '!',             variant: 'neutral' },
    negative:       { label: '−',             variant: 'neutral' },
    over:           { label: '/',             variant: 'neutral' },
    half:           { label: '=',             variant: 'neutral' },
    reception_error:{ label: 'Ошиб. приёма', variant: 'error'   },
    attack_kill:    { label: 'Оч. атаки',    variant: 'point'   },
    attack_blocked: { label: 'Уд. в блок',   variant: 'error'   },
    attack_error:   { label: 'Ошиб. атаки',  variant: 'error'   },
    out_error:      { label: 'Аут',           variant: 'error'   },
    net_error:      { label: 'В сетку',       variant: 'error'   },
    block_error:    { label: 'Ошиб. блока',  variant: 'error'   },
    soft:           { label: 'Смягч.',        variant: 'neutral' },
    touch:          { label: 'Касание',       variant: 'neutral' },
    defense_error:  { label: 'Ошиб. защиты', variant: 'error'   },
    setting_error:  { label: 'Ошиб. пас.',   variant: 'error'   },
  }

  if (q && QUALITY_MAP[q]) return QUALITY_MAP[q]
  if (result === 'success') {
    if (event.action === 'defense')   return { label: 'Поднял', variant: 'neutral' }
    if (event.action === 'reception') return { label: '+',       variant: 'success' }
    return { label: 'Очко', variant: 'success' }
  }
  if (result === 'error')   return { label: 'Ошибка', variant: 'error' }
  return { label: 'В игру', variant: 'neutral' }
}

// ─── Compact Timeline Card ──────────────────────────────────────

function MiniTimelineCard({
  event,
  playerName,
  playerNumber,
  isHome,
  zone,
}: {
  event: MatchEvent
  playerName: string
  playerNumber: string
  isHome: boolean
  zone?: number
}) {
  const actionName = ACTION_LABELS[event.action] ?? event.action
  const { label: resultLabel, variant } = getResultLabel(event)

  const badgeCn = cn(
    'inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
    variant === 'success' && 'bg-success/20 text-success',
    variant === 'point'   && 'bg-success/20 text-success',
    variant === 'error'   && 'bg-error/20 text-error',
    variant === 'neutral' && 'bg-white/10 text-text-muted',
  )

  return (
    <div
      className={cn(
        'rounded-xl p-2.5 backdrop-blur-md',
        'bg-white/[0.03] border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]',
        isHome ? 'border-r-[3px] border-r-primary' : 'border-l-[3px] border-l-pink-500',
      )}
    >
      {/* Row 1: badge + name */}
      <div className={cn('flex items-center gap-2', isHome ? 'flex-row-reverse' : 'flex-row')}>
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md',
            isHome ? 'bg-primary shadow-primary/30' : 'bg-pink-500 shadow-pink-500/30',
          )}
        >
          {playerNumber}
        </div>
        <span className={cn('text-[10px] font-semibold text-slate-400 truncate', isHome ? 'text-right' : 'text-left')}>
          {playerName}
        </span>
      </div>

      {/* Row 2: action + zone */}
      <div className={cn('mt-1 text-[9px] text-slate-500', isHome ? 'text-right' : 'text-left')}>
        {actionName}{zone ? ` · Зона ${zone}` : ''}
      </div>

      {/* Row 3: result badge */}
      <div className={cn('mt-0.5', isHome ? 'text-right' : 'text-left')}>
        <span className={badgeCn}>{resultLabel}</span>
      </div>
    </div>
  )
}

// ─── Rally Score Separator ───────────────────────────────────────

function RallyScoreSeparator({ scoreHome, scoreAway, isHomePoint }: {
  scoreHome: number
  scoreAway: number
  isHomePoint: boolean
}) {
  return (
    <div className="flex items-center justify-center py-2 relative">
      <div className={cn(
        'absolute inset-x-0 top-1/2 h-px',
        isHomePoint ? 'bg-primary/30' : 'bg-pink-500/30',
      )} />
      <div
        className={cn(
          'relative z-10 rounded-full px-4 py-1 text-sm font-black border-2',
          isHomePoint
            ? 'border-primary bg-background text-primary shadow-[0_0_16px_rgba(60,131,246,0.4)]'
            : 'border-pink-500 bg-background text-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.4)]',
        )}
      >
        {scoreHome} : {scoreAway}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

// ─── Main Component ─────────────────────────────────────────────

type FeedItem =
  | { type: 'event'; event: MatchEvent }
  | { type: 'separator'; scoreHome: number; scoreAway: number; isHomePoint: boolean; id: string }

export function EventFeed({
  events,
  homeTeam,
  awayTeam,
  homeTeamId,
  homeLineup,
  maxEvents = 20,
}: {
  events: MatchEvent[]
  homeTeam: Team | undefined
  awayTeam: Team | undefined
  homeTeamId: string
  homeLineup?: LineupEntry[]
  maxEvents?: number
}) {
  const recentEvents = useMemo(() => {
    return events
      .filter((e) => !e.meta?.autoGenerated)
      .slice(-maxEvents)
      .reverse()
  }, [events, maxEvents])

  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = []
    let currentRallyId: string | undefined
    let lastScoringEvent: MatchEvent | null = null

    for (const event of recentEvents) {
      const rid = event.rallyId
      // Rally boundary: insert score separator when rally changes
      if (rid && currentRallyId && rid !== currentRallyId && lastScoringEvent) {
        const homeScored =
          (lastScoringEvent.teamId === homeTeamId && lastScoringEvent.result === 'success') ||
          (lastScoringEvent.teamId !== homeTeamId && lastScoringEvent.result === 'error')
        items.push({
          type: 'separator',
          scoreHome: lastScoringEvent.scoreHome,
          scoreAway: lastScoringEvent.scoreAway,
          isHomePoint: homeScored,
          id: `sep-${currentRallyId}`,
        })
        lastScoringEvent = null
      }
      if (rid) currentRallyId = rid
      if (event.result === 'success' || event.result === 'error') lastScoringEvent = event
      items.push({ type: 'event', event })
    }

    return items
  }, [recentEvents, homeTeamId])

  const getPlayerInfo = (teamId: string, playerId: string): { name: string; number: string; zone?: number } => {
    if (playerId === 'opponent-error') return { name: 'Соперник', number: '??' }
    if (isAwayPlayerId(playerId)) {
      const name = getAwayPlayerDisplayName(playerId)
      const m = playerId.match(/\d+/)
      return { name, number: m ? m[0] : '?' }
    }
    const isHome = teamId === homeTeamId
    const team = isHome ? homeTeam : awayTeam
    const player = team?.players.find((p) => p.id === playerId)
    if (!player) return { name: '?', number: '?' }
    const zone = isHome ? homeLineup?.find((e) => e.playerId === playerId)?.zone : undefined
    return { name: player.lastName, number: String(player.number).padStart(2, '0'), zone }
  }

  if (recentEvents.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-text-muted">
        Нет событий
      </div>
    )
  }

  return (
    <div className="px-3">
      {/* Team legend */}
      <div className="mb-3 flex items-center justify-between px-1 text-[8px] font-bold uppercase tracking-widest opacity-50">
        <span className="text-primary">{homeTeam?.shortName || homeTeam?.name || 'Дом'}</span>
        <span className="text-[7px] text-text-muted">События</span>
        <span className="text-pink-500">{awayTeam?.shortName || awayTeam?.name || 'Гости'}</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Central timeline line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[1.5px] pointer-events-none opacity-25"
          style={{
            background: 'linear-gradient(to bottom, rgba(60,131,246,0.1), rgba(60,131,246,0.8), rgba(60,131,246,0.1))',
            boxShadow: '0 0 10px rgba(60,131,246,0.4)',
          }}
        />

        <div className="space-y-2 relative">
          {feedItems.map((item) => {
            if (item.type === 'separator') {
              return (
                <RallyScoreSeparator
                  key={item.id}
                  scoreHome={item.scoreHome}
                  scoreAway={item.scoreAway}
                  isHomePoint={item.isHomePoint}
                />
              )
            }

            const event = item.event
            const isHome = event.teamId === homeTeamId
            const info = getPlayerInfo(event.teamId, event.playerId)

            return (
              <div key={event.id} className="grid grid-cols-2 gap-4 items-center">
                {/* Left (home) */}
                <div className={cn(!isHome && 'invisible')}>
                  {isHome && (
                    <MiniTimelineCard
                      event={event}
                      playerName={info.name}
                      playerNumber={info.number}
                      isHome={true}
                      zone={info.zone}
                    />
                  )}
                </div>

                {/* Right (away) */}
                <div className={cn(isHome && 'invisible')}>
                  {!isHome && (
                    <MiniTimelineCard
                      event={event}
                      playerName={info.name}
                      playerNumber={info.number}
                      isHome={false}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
