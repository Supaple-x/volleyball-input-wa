import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { useNavigate, Link } from 'react-router'
import type { Team, Player, CourtZone, LineupEntry, Match, MatchSet, SetLineup } from '@volleystats/shared'
import { POSITION_LABELS, VOLLEYBALL_RULES } from '@volleystats/shared'

// Horizontal court layout: 3 rows × 2 cols
// Left column = back row (far from net), Right column = front row (near net)
const HORIZONTAL_ROWS: readonly [CourtZone, CourtZone][] = [
  [5, 4],  // top
  [6, 3],  // middle
  [1, 2],  // bottom
]
import { ArrowLeft, ChevronDown, X, UserPlus, Shield, Circle } from 'lucide-react'
import { generateAwayLineup, AWAY_LIBERO_IDS } from '@/lib/awayPlayers'

interface LineupState {
  zones: Partial<Record<CourtZone, string>>
  liberoIds: string[]
}

const EMPTY_LINEUP: LineupState = {
  zones: {},
  liberoIds: [],
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function PlayerPickerModal({
  players,
  assignedIds,
  onSelect,
  onClose,
  zone,
}: {
  players: Player[]
  assignedIds: Set<string>
  onSelect: (playerId: string) => void
  onClose: () => void
  zone: CourtZone
}) {
  const available = players.filter((p) => !assignedIds.has(p.id) && p.position !== 'libero')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Зона {zone} -- выберите игрока</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-surface-light">
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>
        {available.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Нет доступных игроков</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {available.map((player) => (
              <button
                key={player.id}
                onClick={() => {
                  onSelect(player.id)
                  onClose()
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-surface-light"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {player.number}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">
                    {player.lastName} {player.firstName}
                  </div>
                  <div className="text-xs text-text-muted">{POSITION_LABELS[player.position]}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CourtGrid({
  team,
  lineup,
  onZoneTap,
  onClearZone,
  accentColor = 'primary',
}: {
  team: Team
  lineup: LineupState
  onZoneTap: (zone: CourtZone) => void
  onClearZone: (zone: CourtZone) => void
  accentColor?: 'primary' | 'warning'
}) {
  const getPlayerForZone = (zone: CourtZone): Player | undefined => {
    const playerId = lineup.zones[zone]
    if (!playerId) return undefined
    return team.players.find((p) => p.id === playerId)
  }

  const colorClasses = accentColor === 'primary'
    ? { filled: 'border-primary bg-primary/20 text-primary', empty: 'hover:border-primary/60 hover:text-primary' }
    : { filled: 'border-warning bg-warning/20 text-warning', empty: 'hover:border-warning/60 hover:text-warning' }

  const renderZone = (zone: CourtZone) => {
    const player = getPlayerForZone(zone)
    return (
      <div key={zone} className="flex flex-col items-center gap-1">
        <button
          onClick={() => (player ? onClearZone(zone) : onZoneTap(zone))}
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all',
            player
              ? colorClasses.filled
              : `border-dashed border-text-muted/40 text-text-muted ${colorClasses.empty}`,
          )}
        >
          {player ? (
            <span className="text-lg font-bold">{player.number}</span>
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
        </button>
        <span className="text-[10px] text-text-muted">
          {player ? `${player.lastName}` : `Зона ${zone}`}
        </span>
      </div>
    )
  }

  return (
    <div className="glass p-4">
      <div className="flex items-center">
        {/* Court zones */}
        <div className="flex-1 space-y-3">
          {HORIZONTAL_ROWS.map(([backZone, frontZone]) => (
            <div key={`${backZone}-${frontZone}`} className="flex justify-around">
              {renderZone(backZone)}
              {renderZone(frontZone)}
            </div>
          ))}
        </div>
        {/* Vertical net indicator */}
        <div className="flex flex-col items-center gap-1 self-stretch ml-3 py-2">
          <div className="w-px flex-1 bg-text-muted/30" />
          <span className="text-[8px] uppercase tracking-widest text-text-muted/50 [writing-mode:vertical-lr]">
            Сетка
          </span>
          <div className="w-px flex-1 bg-text-muted/30" />
        </div>
      </div>
    </div>
  )
}

function TeamSelector({
  label,
  teams,
  selectedId,
  disabledId,
  onSelect,
}: {
  label: string
  teams: Team[]
  selectedId: string
  disabledId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex-1">
      <label className="mb-1.5 block text-xs font-medium text-text-muted">{label}</label>
      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-surface-light px-4 py-3 pr-10 text-sm font-medium text-text-primary outline-none transition focus:border-primary"
        >
          <option value="">Выберите команду</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === disabledId}>
              {t.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      </div>
    </div>
  )
}

function LiberoSelector({
  team,
  selectedIds,
  onSelect,
}: {
  team: Team
  selectedIds: string[]
  onSelect: (id: string) => void
}) {
  const liberos = team.players.filter((p) => p.position === 'libero')

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Либеро</h3>
        <span className="text-xs text-text-muted">({selectedIds.length}/2)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {liberos.map((player) => {
          const isSelected = selectedIds.includes(player.id)
          return (
            <button
              key={player.id}
              onClick={() => onSelect(player.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                isSelected
                  ? 'border-success bg-success/20 text-success'
                  : 'border-border text-text-secondary hover:border-border-light',
              )}
            >
              <span className="font-bold">{player.number}</span>
              <span>{player.lastName}</span>
            </button>
          )
        })}
        {liberos.length === 0 && (
          <p className="text-xs text-text-muted">Нет игроков с позицией либеро</p>
        )}
      </div>
    </div>
  )
}

export function NewMatchPage() {
  const navigate = useNavigate()
  const teams = useLiveQuery(() => db.teams.toArray()) ?? []

  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [homeLineup, setHomeLineup] = useState<LineupState>(EMPTY_LINEUP)
  const [servingTeam, setServingTeam] = useState<'home' | 'away' | null>(null)
  const [pickerZone, setPickerZone] = useState<CourtZone | null>(null)

  const homeTeam = teams.find((t) => t.id === homeTeamId)
  const awayTeam = teams.find((t) => t.id === awayTeamId)

  const homeAssignedIds = useMemo(() => {
    const ids = new Set<string>()
    Object.values(homeLineup.zones).forEach((id) => { if (id) ids.add(id) })
    for (const lid of homeLineup.liberoIds) ids.add(lid)
    return ids
  }, [homeLineup])

  const homeLineupCount = Object.keys(homeLineup.zones).length
  const canStart = homeTeamId !== '' && awayTeamId !== '' && homeLineupCount === 6 && servingTeam !== null

  const handleZoneTap = (zone: CourtZone) => {
    setPickerZone(zone)
  }

  const handleClearZone = (zone: CourtZone) => {
    setHomeLineup((prev) => {
      const newZones = { ...prev.zones }
      delete newZones[zone]
      return { ...prev, zones: newZones }
    })
  }

  const handlePlayerSelect = (playerId: string) => {
    if (pickerZone === null) return
    setHomeLineup((prev) => ({
      ...prev,
      zones: { ...prev.zones, [pickerZone]: playerId },
    }))
    setPickerZone(null)
  }

  const handleLiberoSelect = (playerId: string) => {
    setHomeLineup((prev) => {
      const already = prev.liberoIds.includes(playerId)
      const newIds = already
        ? prev.liberoIds.filter((id) => id !== playerId)
        : prev.liberoIds.length < 2
          ? [...prev.liberoIds, playerId]
          : prev.liberoIds // already 2, ignore
      return { ...prev, liberoIds: newIds }
    })
  }

  const handleHomeTeamChange = (id: string) => {
    setHomeTeamId(id)
    setHomeLineup(EMPTY_LINEUP)
  }
  const handleAwayTeamChange = (id: string) => {
    setAwayTeamId(id)
  }

  const handleStartMatch = async () => {
    if (!canStart) return

    const buildLineup = (lineup: LineupState): LineupEntry[] => {
      return Object.entries(lineup.zones).map(([zone, playerId]) => ({
        playerId: playerId!,
        zone: Number(zone) as CourtZone,
        isLibero: false,
      }))
    }

    const homeEntries = buildLineup(homeLineup)
    const awayEntries = generateAwayLineup()
    const servingTeamId = servingTeam === 'home' ? homeTeamId : awayTeamId

    const initialSet: MatchSet = {
      number: 1,
      scoreHome: 0,
      scoreAway: 0,
      isFinished: false,
      firstServeTeamId: servingTeamId,
    }

    const setLineup: SetLineup = {
      setNumber: 1,
      homeLineup: homeEntries,
      awayLineup: awayEntries,
    }

    const matchDateISO = matchDate ? new Date(matchDate).toISOString() : new Date().toISOString()

    const match: Match = {
      id: generateId(),
      date: matchDateISO,
      homeTeamId,
      awayTeamId,
      sets: [initialSet],
      currentSet: 1,
      status: 'live',
      homeLineup: homeEntries,
      awayLineup: awayEntries,
      setLineups: [setLineup],
      servingTeamId,
      firstServeTeamId: servingTeamId,
      homeLiberoId: homeLineup.liberoIds[0] || undefined,
      homeLiberoIds: homeLineup.liberoIds.length > 0 ? homeLineup.liberoIds : undefined,
      awayLiberoIds: [...AWAY_LIBERO_IDS],
      homeTimeouts: 0,
      awayTimeouts: 0,
      homeSubstitutions: 0,
      awaySubstitutions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await db.matches.add(match)
    navigate(`/matches/${match.id}/live`)
  }

  return (
    <div className="px-4 pt-safe pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <Link to="/matches" className="rounded-full p-2 hover:bg-surface-light">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <h1 className="text-xl font-bold">Настройка матча</h1>
      </div>

      {/* Team Selectors */}
      <div className="mb-6 flex gap-3">
        <TeamSelector
          label="Хозяева"
          teams={teams}
          selectedId={homeTeamId}
          disabledId={awayTeamId}
          onSelect={handleHomeTeamChange}
        />
        <div className="flex items-end pb-3 text-lg font-bold text-text-muted">VS</div>
        <TeamSelector
          label="Гости"
          teams={teams}
          selectedId={awayTeamId}
          disabledId={homeTeamId}
          onSelect={handleAwayTeamChange}
        />
      </div>

      {/* Date & Time */}
      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-medium text-text-muted">Дата и время</label>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary"
          />
          <button
            onClick={() => {
              const now = new Date()
              now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
              setMatchDate(now.toISOString().slice(0, 16))
            }}
            className="shrink-0 rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-light active:scale-[0.98]"
          >
            Сейчас
          </button>
        </div>
      </div>

      {homeTeamId && awayTeamId && homeTeam && awayTeam && (
        <>
          {/* Step 1: Serving Team Selector */}
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">1</span>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Кто подаёт первым?
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setServingTeam('home')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition',
                  servingTeam === 'home'
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border text-text-secondary hover:border-border-light',
                )}
              >
                <Circle className={cn('h-3 w-3', servingTeam === 'home' ? 'fill-primary' : '')} />
                {homeTeam.name}
              </button>
              <button
                onClick={() => setServingTeam('away')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition',
                  servingTeam === 'away'
                    ? 'border-warning bg-warning/20 text-warning'
                    : 'border-border text-text-secondary hover:border-border-light',
                )}
              >
                <Circle className={cn('h-3 w-3', servingTeam === 'away' ? 'fill-warning' : '')} />
                {awayTeam.name}
              </button>
            </div>
          </div>

          {/* Step 2: Home Team Lineup (only after serving team chosen) */}
          {servingTeam !== null && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">2</span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                  Расстановка — {homeTeam.name}
                </h2>
                <span className="ml-auto text-xs text-text-muted">
                  {homeLineupCount}/{VOLLEYBALL_RULES.PLAYERS_ON_COURT}
                </span>
              </div>
              <CourtGrid
                team={homeTeam}
                lineup={homeLineup}
                onZoneTap={handleZoneTap}
                onClearZone={handleClearZone}
                accentColor="primary"
              />
              <LiberoSelector
                team={homeTeam}
                selectedIds={homeLineup.liberoIds}
                onSelect={handleLiberoSelect}
              />
            </div>
          )}
        </>
      )}

      {/* Player picker modal */}
      {pickerZone !== null && homeTeam && (
        <PlayerPickerModal
          players={homeTeam.players}
          assignedIds={homeAssignedIds}
          onSelect={handlePlayerSelect}
          onClose={() => setPickerZone(null)}
          zone={pickerZone}
        />
      )}

      {/* Start Match Button */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border bg-background/90 p-4 pb-safe backdrop-blur-xl">
        <button
          onClick={handleStartMatch}
          disabled={!canStart}
          className={cn(
            'w-full rounded-full py-4 text-base font-bold uppercase tracking-wider transition',
            canStart
              ? 'bg-success text-white shadow-lg shadow-success/30 active:scale-[0.98]'
              : 'bg-surface-light text-text-muted cursor-not-allowed',
          )}
        >
          Начать матч
        </button>
      </div>
    </div>
  )
}

export default NewMatchPage;
