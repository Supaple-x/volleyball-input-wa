import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  Users,
  Trophy,
  Award,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'
import type { Team, Player, Position } from '@volleystats/shared'
import { POSITION_LABELS } from '@volleystats/shared'

// === Position color mapping ===
const POSITION_COLORS: Record<Position, { bg: string; text: string }> = {
  setter: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  opposite: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  outside: { bg: 'bg-green-500/20', text: 'text-green-400' },
  middle: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  libero: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
}

const JERSEY_COLORS: Record<Position, string> = {
  setter: 'bg-blue-500',
  opposite: 'bg-purple-500',
  outside: 'bg-green-500',
  middle: 'bg-orange-500',
  libero: 'bg-cyan-500',
}

const ALL_POSITIONS: Position[] = ['setter', 'opposite', 'outside', 'middle', 'libero']

// === Position tag chip ===
function PositionChip({ position }: { position: Position }) {
  const colors = POSITION_COLORS[position]
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        colors.bg,
        colors.text,
      )}
    >
      {POSITION_LABELS[position]}
    </span>
  )
}

// === Player row component ===
function PlayerRow({
  player,
  onEdit,
  onDelete,
}: {
  player: Player
  onEdit: (player: Player) => void
  onDelete: (playerId: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const jerseyColor = JERSEY_COLORS[player.position]

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-surface-light/40"
      onClick={() => setShowActions(!showActions)}
    >
      {/* Jersey number */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
          jerseyColor,
        )}
      >
        {player.number}
      </div>

      {/* Name & position */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {player.firstName} {player.lastName}
        </p>
        <div className="mt-1">
          <PositionChip position={player.position} />
        </div>
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 transition-all',
          showActions ? 'opacity-100' : 'opacity-0',
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(player)
          }}
          className="touch-target h-9 w-9 rounded-lg text-text-muted transition hover:bg-surface-light hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(player.id)
          }}
          className="touch-target h-9 w-9 rounded-lg text-text-muted transition hover:bg-surface-light hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// === Add/Edit player form ===
function PlayerForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Player
  onSubmit: (data: { number: number; firstName: string; lastName: string; position: Position }) => void
  onCancel: () => void
}) {
  const [number, setNumber] = useState(initial?.number?.toString() ?? '')
  const [firstName, setFirstName] = useState(initial?.firstName ?? '')
  const [lastName, setLastName] = useState(initial?.lastName ?? '')
  const [position, setPosition] = useState<Position>(initial?.position ?? 'outside')
  const numberRef = useRef<HTMLInputElement>(null)

  const isValid = number.trim() && firstName.trim() && lastName.trim()

  function handleSubmit() {
    if (!isValid) return
    onSubmit({
      number: parseInt(number, 10),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      position,
    })
  }

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">
          {initial ? 'Редактировать игрока' : 'Новый игрок'}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="touch-target h-8 w-8 rounded-lg text-text-muted transition hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Number + First name row */}
        <div className="flex gap-3">
          <input
            ref={numberRef}
            type="number"
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="#"
            min={0}
            max={99}
            autoFocus
            className="w-16 shrink-0 rounded-xl border border-border bg-surface-light px-3 py-3 text-center text-sm font-bold text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Имя"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary"
          />
        </div>

        {/* Last name */}
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Фамилия"
          className="w-full rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />

        {/* Position select — inline chips */}
        <div>
          <span className="mb-1.5 block text-xs text-text-muted">Позиция</span>
          <div className="flex flex-wrap gap-2">
            {ALL_POSITIONS.map((pos) => {
              const active = pos === position
              const colors = POSITION_COLORS[pos]
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPosition(pos)}
                  className={cn(
                    'rounded-full px-3 py-2 text-xs font-semibold transition',
                    active
                      ? `${colors.bg} ${colors.text} ring-1 ring-current`
                      : 'bg-surface-light text-text-muted hover:text-text-secondary',
                  )}
                >
                  {POSITION_LABELS[pos]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className={cn(
            'rounded-xl py-3 text-sm font-semibold transition',
            isValid
              ? 'bg-primary text-white hover:bg-primary-light'
              : 'bg-surface-light text-text-muted cursor-not-allowed',
          )}
        >
          {initial ? 'Сохранить' : 'Добавить игрока'}
        </button>
      </div>
    </div>
  )
}

// === Stat card ===
function StatCard({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-surface-light/50 py-3">
      <span className="text-xl font-bold text-text-primary">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  )
}

// === Main page ===
export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

  const team = useLiveQuery(
    () => (teamId ? db.teams.get(teamId) : undefined),
    [teamId],
  )

  const matches = useLiveQuery(
    () =>
      teamId
        ? db.matches
            .where('homeTeamId')
            .equals(teamId)
            .or('awayTeamId')
            .equals(teamId)
            .toArray()
        : [],
    [teamId],
  ) ?? []

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [editingCity, setEditingCity] = useState(false)
  const [cityValue, setCityValue] = useState('')
  const [showPlayerForm, setShowPlayerForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  if (team === undefined) {
    return (
      <div className="px-4 pt-safe">
        <div className="py-6">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-light" />
        </div>
        <div className="glass h-40 animate-pulse" />
      </div>
    )
  }

  if (team === null) {
    return (
      <div className="px-4 pt-safe">
        <div className="flex items-center gap-3 py-6">
          <button
            type="button"
            onClick={() => navigate('/teams')}
            className="touch-target h-10 w-10 rounded-xl text-text-muted transition hover:text-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">Команда не найдена</h1>
        </div>
      </div>
    )
  }

  const initials = team.shortName || team.name.slice(0, 2).toUpperCase()
  const matchCount = matches.length
  const winCount = matches.filter((m) => {
    if (m.status !== 'finished') return false
    const homeWins = m.sets.filter((s) => s.scoreHome > s.scoreAway).length
    const awayWins = m.sets.filter((s) => s.scoreAway > s.scoreHome).length
    const isHome = m.homeTeamId === teamId
    return isHome ? homeWins > awayWins : awayWins > homeWins
  }).length

  // === Team mutations ===
  async function handleSaveName() {
    if (!team || !nameValue.trim()) return
    const updated: Team = {
      ...team,
      name: nameValue.trim(),
      shortName: nameValue.trim().slice(0, 3).toUpperCase(),
      updatedAt: new Date().toISOString(),
    }
    await db.teams.put(updated)
    setEditingName(false)
  }

  async function handleSaveCity() {
    if (!team) return
    const updated: Team = {
      ...team,
      city: cityValue.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    await db.teams.put(updated)
    setEditingCity(false)
  }

  async function handleAddPlayer(data: {
    number: number
    firstName: string
    lastName: string
    position: Position
  }) {
    if (!team) return
    const newPlayer: Player = {
      id: nanoid(),
      ...data,
    }
    const updated: Team = {
      ...team,
      players: [...team.players, newPlayer],
      updatedAt: new Date().toISOString(),
    }
    await db.teams.put(updated)
    setShowPlayerForm(false)
  }

  async function handleEditPlayer(data: {
    number: number
    firstName: string
    lastName: string
    position: Position
  }) {
    if (!team || !editingPlayer) return
    const updated: Team = {
      ...team,
      players: team.players.map((p) =>
        p.id === editingPlayer.id ? { ...p, ...data } : p,
      ),
      updatedAt: new Date().toISOString(),
    }
    await db.teams.put(updated)
    setEditingPlayer(null)
  }

  async function handleDeletePlayer(playerId: string) {
    if (!team) return
    const updated: Team = {
      ...team,
      players: team.players.filter((p) => p.id !== playerId),
      updatedAt: new Date().toISOString(),
    }
    await db.teams.put(updated)
    setShowDeleteConfirm(null)
  }

  async function handleDeleteTeam() {
    if (!team) return
    await db.teams.delete(team.id)
    navigate('/teams')
  }

  return (
    <div className="px-4 pt-safe pb-safe">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={() => navigate('/teams')}
          className="touch-target h-10 w-10 rounded-xl text-text-muted transition hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary">
          Управление командой
        </h1>
      </div>

      {/* Team header card */}
      <div className="glass mb-4 p-5">
        <div className="flex items-start gap-4">
          {/* Large initials circle */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
            {initials}
          </div>

          {/* Name & city (editable) */}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-primary bg-surface-light px-3 py-1.5 text-base font-semibold text-text-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="touch-target h-8 w-8 rounded-lg text-primary"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="touch-target h-8 w-8 rounded-lg text-text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameValue(team.name)
                  setEditingName(true)
                }}
                className="group flex items-center gap-2 text-left"
              >
                <h2 className="text-lg font-bold text-text-primary">
                  {team.name}
                </h2>
                <Pencil className="h-3.5 w-3.5 text-text-muted opacity-0 transition group-hover:opacity-100" />
              </button>
            )}

            {editingCity ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={cityValue}
                  onChange={(e) => setCityValue(e.target.value)}
                  placeholder="Город"
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-primary bg-surface-light px-3 py-1 text-sm text-text-secondary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCity()
                    if (e.key === 'Escape') setEditingCity(false)
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveCity}
                  className="touch-target h-8 w-8 rounded-lg text-primary"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCity(false)}
                  className="touch-target h-8 w-8 rounded-lg text-text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCityValue(team.city ?? '')
                  setEditingCity(true)
                }}
                className="group mt-1 flex items-center gap-2 text-left"
              >
                <span className="text-sm text-text-muted">
                  {team.city || 'Добавить город'}
                </span>
                <Pencil className="h-3 w-3 text-text-muted opacity-0 transition group-hover:opacity-100" />
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex gap-2">
          <StatCard label="Игроков" value={team.players.length} />
          <StatCard label="Игр" value={matchCount} />
          <StatCard label="Побед" value={winCount} />
        </div>
      </div>

      {/* Players section */}
      <div className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-text-primary">
              Состав
            </h3>
            <span className="rounded-full bg-surface-light px-2 py-0.5 text-xs font-medium text-text-muted">
              {team.players.length}
            </span>
          </div>
          {!showPlayerForm && !editingPlayer && (
            <button
              type="button"
              onClick={() => setShowPlayerForm(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить
            </button>
          )}
        </div>

        {/* Player list */}
        {team.players.length > 0 ? (
          <div className="glass divide-y divide-border overflow-hidden">
            {team.players
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((player) =>
                editingPlayer?.id === player.id ? (
                  <div key={player.id} className="p-3">
                    <PlayerForm
                      initial={player}
                      onSubmit={handleEditPlayer}
                      onCancel={() => setEditingPlayer(null)}
                    />
                  </div>
                ) : (
                  <div key={player.id} className="relative">
                    <PlayerRow
                      player={player}
                      onEdit={(p) => {
                        setEditingPlayer(p)
                        setShowPlayerForm(false)
                      }}
                      onDelete={(id) => setShowDeleteConfirm(id)}
                    />

                    {/* Delete confirmation */}
                    {showDeleteConfirm === player.id && (
                      <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-xl bg-surface/95 backdrop-blur-sm px-4">
                        <span className="text-sm text-text-secondary">
                          Удалить?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeletePlayer(player.id)}
                          className="rounded-lg bg-error/20 px-4 py-2 text-xs font-semibold text-error transition hover:bg-error/30"
                        >
                          Да
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(null)}
                          className="rounded-lg bg-surface-light px-4 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-light/80"
                        >
                          Нет
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
          </div>
        ) : (
          !showPlayerForm && (
            <div className="glass p-6 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-text-muted" />
              <p className="mb-1 text-sm text-text-secondary">
                Нет игроков в составе
              </p>
              <p className="text-xs text-text-muted">
                Добавьте игроков для ведения статистики
              </p>
            </div>
          )
        )}

        {/* Add player form */}
        {showPlayerForm && (
          <div className="mt-3">
            <PlayerForm
              onSubmit={handleAddPlayer}
              onCancel={() => setShowPlayerForm(false)}
            />
          </div>
        )}

        {/* Add player button (when list exists and form is hidden) */}
        {team.players.length > 0 && !showPlayerForm && !editingPlayer && (
          <button
            type="button"
            onClick={() => setShowPlayerForm(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-text-muted transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Добавить игрока
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="mb-8 mt-6">
        <button
          type="button"
          onClick={handleDeleteTeam}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-error/20 py-3 text-sm font-medium text-error/70 transition hover:border-error/40 hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
          Удалить команду
        </button>
      </div>
    </div>
  )
}

export default TeamDetailPage;
