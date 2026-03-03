import { useMemo, useState } from 'react'
import type { Player, CourtZone, LineupEntry, Team, RallyPhase, ActionType, ActionResult } from '@volleystats/shared'
import { cn } from '@/lib/utils'
import { isAwayPlayerId, getAwayPlayerShortName } from '@/lib/awayPlayers'
import { getAvailableActions, getAwayAvailableActions } from '@/lib/matchEngine'
import type { ActionConfig } from '@/lib/matchEngine'

const HORIZONTAL_ROWS: readonly [CourtZone, CourtZone][] = [
  [5, 4],
  [6, 3],
  [1, 2],
]

// Away court is mirrored (teams face each other across the net)
const AWAY_HORIZONTAL_ROWS: readonly [CourtZone, CourtZone][] = [
  [2, 1],
  [3, 6],
  [4, 5],
]

// ─── Player Circle ──────────────────────────────────────────────

function PlayerCircle({
  number,
  name,
  zone,
  isSelected,
  isLibero,
  isExpected,
  color,
  onTap,
}: {
  number: string
  name?: string
  zone: CourtZone
  isSelected: boolean
  isLibero: boolean
  isExpected: boolean
  color: 'primary' | 'warning'
  onTap: () => void
}) {
  const isPrimary = color === 'primary'

  return (
    <button
      onClick={onTap}
      className={cn(
        'relative flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all active:scale-95',
        isLibero
          ? isSelected
            ? 'bg-warning/30 ring-2 ring-warning'
            : 'bg-warning/15 border border-warning/40'
          : isSelected
            ? isPrimary
              ? 'bg-primary/30 ring-2 ring-primary shadow-lg shadow-primary/20'
              : 'bg-warning/30 ring-2 ring-warning shadow-lg shadow-warning/20'
            : isExpected
              ? isPrimary
                ? 'bg-surface-light border border-border-light hover:border-text-muted/60'
                : 'bg-surface-light border border-warning/30 hover:border-warning/60'
              : 'bg-surface border border-border/50 opacity-60',
      )}
    >
      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface-light text-[8px] font-bold text-text-muted">
        {zone}
      </span>
      <span className={cn('text-sm font-bold leading-tight', !isPrimary && 'text-[9px] text-warning')}>
        {number}
      </span>
      {name && (
        <span className="max-w-[44px] truncate text-[7px] leading-tight text-text-muted">
          {name}
        </span>
      )}
    </button>
  )
}

function EmptyZone({ zone }: { zone: CourtZone }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-text-muted/30">
        <span className="text-[10px] text-text-muted">{zone}</span>
      </div>
    </div>
  )
}

// ─── Action Popover (floats on player circle) ───────────────────

function ActionPopover({
  position,
  phase,
  isAway,
  zone,
  servingTeamId,
  receivingTeamId,
  onAction,
}: {
  position: 'above' | 'below'
  phase: RallyPhase
  isAway: boolean
  zone: CourtZone
  servingTeamId: string
  receivingTeamId: string
  onAction: (action: ActionType, result: ActionResult, quality?: string) => void
}) {
  const [pendingParent, setPendingParent] = useState<ActionConfig | null>(null)

  const phaseActions = isAway
    ? getAwayAvailableActions(phase, servingTeamId, zone)
    : getAvailableActions(phase, servingTeamId, receivingTeamId, zone)

  if (phaseActions.sections.length === 0) return null

  const allActions = phaseActions.sections.flatMap(s => s.actions)

  const btnCls = (v: string) => cn(
    'rounded-lg py-1.5 text-[10px] font-bold text-center transition-all active:scale-90',
    v === 'success' && 'bg-success/25 text-success',
    v === 'error' && 'bg-error/25 text-error',
    v === 'neutral' && 'bg-white/10 text-text-secondary',
  )

  const handleAction = (e: React.MouseEvent, a: ActionConfig) => {
    e.stopPropagation()
    if (a.subOptions) {
      setPendingParent(a)
    } else {
      onAction(a.action, a.result, a.quality)
    }
  }

  const handleSubAction = (e: React.MouseEvent, sub: ActionConfig) => {
    e.stopPropagation()
    onAction(sub.action, sub.result, sub.quality)
    setPendingParent(null)
  }

  let content: React.ReactNode
  let width: string

  if (phase === 'serve') {
    // Home: 4 buttons (2×2), Away: 3 buttons (1×3)
    const cols = allActions.length > 3 ? 'grid-cols-2' : 'grid-cols-3'
    width = allActions.length > 3 ? 'w-[130px]' : 'w-[140px]'
    content = (
      <div className={cn('grid gap-1', cols)}>
        {allActions.map(a => (
          <button key={a.quality} onClick={(e) => handleAction(e, a)} className={btnCls(a.variant)}>
            {a.label}
          </button>
        ))}
      </div>
    )
  } else if (phase === 'reception') {
    if (allActions.length <= 3) {
      width = 'w-[110px]'
      content = (
        <div className={cn('grid gap-1', `grid-cols-${allActions.length}`)}>
          {allActions.map(a => (
            <button key={a.quality} onClick={(e) => handleAction(e, a)} className={btnCls(a.variant)}>
              {a.label}
            </button>
          ))}
        </div>
      )
    } else {
      // Home full reception: 7 buttons (4 + 3 rows)
      width = 'w-[156px]'
      content = (
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-1">
            {allActions.slice(0, 4).map(a => (
              <button key={a.quality} onClick={(e) => handleAction(e, a)} className={btnCls(a.variant)}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {allActions.slice(4).map(a => (
              <button key={a.quality} onClick={(e) => handleAction(e, a)} className={btnCls(a.variant)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )
    }
  } else {
    // in_play: flatten with section prefix (Ат+, Бл−, Зщ+, etc.)
    const labeledActions = phaseActions.sections.flatMap(section =>
      section.actions.map(a => ({
        ...a,
        label: section.title ? `${section.title.slice(0, 2)}${a.label}` : a.label,
      }))
    )
    width = labeledActions.length > 6 ? 'w-[160px]' : 'w-[140px]'

    if (pendingParent) {
      // Sub-level: show specific error options
      content = (
        <div className="space-y-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); setPendingParent(null) }}
            className="flex items-center gap-1 text-[9px] text-text-muted hover:text-text-secondary"
          >
            ← {pendingParent.label}
          </button>
          <div className="grid grid-cols-2 gap-1">
            {pendingParent.subOptions!.map(sub => (
              <button
                key={sub.quality}
                onClick={(e) => handleSubAction(e, sub)}
                className={btnCls(sub.variant)}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )
    } else {
      content = (
        <div className="grid grid-cols-3 gap-1">
          {labeledActions.map(a => (
            <button
              key={`${a.action}-${a.result}-${a.quality || ''}`}
              onClick={(e) => handleAction(e, a)}
              className={btnCls(a.variant)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )
    }
  }

  return (
    <div
      className={cn(
        'absolute left-1/2 z-30 -translate-x-1/2',
        width,
        'rounded-xl bg-surface/95 backdrop-blur-lg border border-border-light p-2 shadow-2xl',
        position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow indicator */}
      <div className={cn(
        'absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-surface/95 border-border-light',
        position === 'above'
          ? '-bottom-[5px] border-r border-b'
          : '-top-[5px] border-l border-t',
      )} />
      {content}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export function DualCourtView({
  homeTeam,
  awayTeam,
  homeLineup,
  awayLineup,
  selectedPlayerId,
  expectedTeamId,
  rallyPhase,
  servingTeamId,
  receivingTeamId,
  onSelectPlayer,
  onPlayerAction,
}: {
  homeTeam: Team | undefined
  awayTeam: Team | undefined
  homeLineup: LineupEntry[]
  awayLineup: LineupEntry[]
  selectedPlayerId: string | null
  expectedTeamId: string | null
  rallyPhase: RallyPhase
  servingTeamId: string
  receivingTeamId: string
  onSelectPlayer: (playerId: string, teamId: string) => void
  onPlayerAction: (playerId: string, teamId: string, action: ActionType, result: ActionResult, quality?: string) => void
}) {
  const homePlayerMap = useMemo(() => {
    const map = new Map<CourtZone, Player>()
    if (!homeTeam) return map
    for (const entry of homeLineup) {
      const player = homeTeam.players.find((p) => p.id === entry.playerId)
      if (player) map.set(entry.zone, player)
    }
    return map
  }, [homeTeam, homeLineup])

  const awayZoneMap = useMemo(() => {
    const map = new Map<CourtZone, LineupEntry>()
    for (const entry of awayLineup) {
      map.set(entry.zone, entry)
    }
    return map
  }, [awayLineup])

  const homeIsExpected = expectedTeamId === null || expectedTeamId === homeTeam?.id
  const awayIsExpected = expectedTeamId === null || expectedTeamId === awayTeam?.id
  const hasAwayLineup = awayLineup.length > 0 && awayLineup.some((e) => isAwayPlayerId(e.playerId))

  /** Should a popover show for this player? */
  const canShowPopover = (zone: CourtZone, teamIsExpected: boolean, _isAway: boolean) => {
    if (rallyPhase === 'idle' || rallyPhase === 'rally_over') return false
    if (!teamIsExpected) return false
    if (rallyPhase === 'serve' && zone !== 1) return false
    return true
  }

  const popoverPositionHome = (zone: CourtZone): 'above' | 'below' =>
    zone === 1 || zone === 2 ? 'above' : 'below'

  const popoverPositionAway = (zone: CourtZone): 'above' | 'below' =>
    zone === 4 || zone === 5 ? 'above' : 'below'

  const getHomeEntry = (zone: CourtZone) => homeLineup.find((e) => e.zone === zone)

  const renderHomeCircle = (zone: CourtZone) => {
    const player = homePlayerMap.get(zone)
    const entry = getHomeEntry(zone)
    if (!player || !entry) return <EmptyZone key={zone} zone={zone} />

    const isSelected = selectedPlayerId === entry.playerId
    const showPopover = isSelected && canShowPopover(zone, homeIsExpected, false)

    return (
      <div key={zone} className="relative flex flex-col items-center">
        <PlayerCircle
          number={String(player.number)}
          name={player.lastName?.slice(0, 5)}
          zone={zone}
          isSelected={isSelected}
          isLibero={entry.isLibero}
          isExpected={homeIsExpected}
          color="primary"
          onTap={() => homeTeam && onSelectPlayer(entry.playerId, homeTeam.id)}
        />
        {showPopover && (
          <ActionPopover
            position={popoverPositionHome(zone)}
            phase={rallyPhase}
            isAway={false}
            zone={zone}
            servingTeamId={servingTeamId}
            receivingTeamId={receivingTeamId}
            onAction={(action, result, quality) =>
              onPlayerAction(entry.playerId, homeTeam!.id, action, result, quality)
            }
          />
        )}
      </div>
    )
  }

  const renderAwayCircle = (zone: CourtZone) => {
    const entry = awayZoneMap.get(zone)
    if (!entry) return <EmptyZone key={zone} zone={zone} />

    const isSelected = selectedPlayerId === entry.playerId
    const showPopover = isSelected && canShowPopover(zone, awayIsExpected, true)

    return (
      <div key={zone} className="relative flex flex-col items-center">
        <PlayerCircle
          number={getAwayPlayerShortName(entry.playerId)}
          zone={zone}
          isSelected={isSelected}
          isLibero={entry.isLibero}
          isExpected={awayIsExpected}
          color="warning"
          onTap={() => awayTeam && onSelectPlayer(entry.playerId, awayTeam.id)}
        />
        {showPopover && (
          <ActionPopover
            position={popoverPositionAway(zone)}
            phase={rallyPhase}
            isAway={true}
            zone={zone}
            servingTeamId={servingTeamId}
            receivingTeamId={receivingTeamId}
            onAction={(action, result, quality) =>
              onPlayerAction(entry.playerId, awayTeam!.id, action, result, quality)
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="glass mx-3" style={{ overflow: 'visible' }}>
      <div className="flex items-center" style={{ overflow: 'visible' }}>
        {/* Home court */}
        {homeTeam && (
          <div className={cn('flex-1 px-3 py-2', homeIsExpected ? 'opacity-100' : 'opacity-50')} style={{ overflow: 'visible' }}>
            <span className="mb-1.5 block text-center text-[10px] font-semibold uppercase tracking-wider text-primary">
              {homeTeam.shortName || homeTeam.name}
            </span>
            <div className="space-y-2" style={{ overflow: 'visible' }}>
              {HORIZONTAL_ROWS.map(([backZone, frontZone]) => (
                <div key={`h-${backZone}-${frontZone}`} className="flex justify-around" style={{ overflow: 'visible' }}>
                  {renderHomeCircle(backZone)}
                  {renderHomeCircle(frontZone)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Net */}
        <div className="flex flex-col items-center gap-1 self-stretch py-4">
          <div className="w-px flex-1 bg-text-muted/30" />
          <span className="text-[8px] uppercase tracking-widest text-text-muted/50 [writing-mode:vertical-lr]">
            Сетка
          </span>
          <div className="w-px flex-1 bg-text-muted/30" />
        </div>

        {/* Away court */}
        {awayTeam && hasAwayLineup ? (
          <div className={cn('flex-1 px-3 py-2', awayIsExpected ? 'opacity-100' : 'opacity-50')} style={{ overflow: 'visible' }}>
            <span className="mb-1.5 block text-center text-[10px] font-semibold uppercase tracking-wider text-warning">
              {awayTeam.shortName || awayTeam.name}
            </span>
            <div className="space-y-2" style={{ overflow: 'visible' }}>
              {AWAY_HORIZONTAL_ROWS.map(([leftZone, rightZone]) => (
                <div key={`a-${leftZone}-${rightZone}`} className="flex justify-around" style={{ overflow: 'visible' }}>
                  {renderAwayCircle(leftZone)}
                  {renderAwayCircle(rightZone)}
                </div>
              ))}
            </div>
          </div>
        ) : awayTeam ? (
          <div className="flex flex-1 items-center justify-center px-3 py-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-warning">
              {awayTeam.shortName || awayTeam.name}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
