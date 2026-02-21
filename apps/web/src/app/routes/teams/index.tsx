import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Users, MapPin, ChevronRight, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { nanoid } from 'nanoid'
import type { Team } from '@volleystats/shared'

function TeamCard({ team }: { team: Team }) {
  const initials = team.shortName || team.name.slice(0, 2).toUpperCase()

  return (
    <Link
      to={`/teams/${team.id}`}
      className="glass flex items-center gap-4 p-4 transition active:scale-[0.98] hover:border-border-light"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-text-primary">
          {team.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
          {team.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {team.city}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {team.players.length} игроков
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
    </Link>
  )
}

export function TeamsPage() {
  const teams = useLiveQuery(() => db.teams.orderBy('createdAt').reverse().toArray()) ?? []
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('')

  async function handleCreateTeam() {
    const name = newName.trim()
    if (!name) return

    const now = new Date().toISOString()
    const team: Team = {
      id: nanoid(),
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      city: newCity.trim() || undefined,
      players: [],
      createdAt: now,
      updatedAt: now,
    }

    await db.teams.add(team)
    setNewName('')
    setNewCity('')
    setShowForm(false)
  }

  return (
    <div className="px-4 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <h1 className="text-xl font-bold text-text-primary">Команды</h1>
        <span className="text-sm text-text-muted">
          {teams.length > 0 && `${teams.length} команд`}
        </span>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="glass mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Новая команда
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setNewName('')
                setNewCity('')
              }}
              className="touch-target h-8 w-8 rounded-lg text-text-muted transition hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название команды"
              autoFocus
              className="w-full rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTeam()
              }}
            />
            <input
              type="text"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="Город (необязательно)"
              className="w-full rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTeam()
              }}
            />
            <button
              type="button"
              onClick={handleCreateTeam}
              disabled={!newName.trim()}
              className={cn(
                'rounded-xl py-3 text-sm font-semibold transition',
                newName.trim()
                  ? 'bg-primary text-white hover:bg-primary-light'
                  : 'bg-surface-light text-text-muted cursor-not-allowed',
              )}
            >
              Создать
            </button>
          </div>
        </div>
      )}

      {/* Teams list */}
      {teams.length === 0 && !showForm ? (
        <div className="glass p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-light">
            <Users className="h-8 w-8 text-text-muted" />
          </div>
          <p className="mb-1 text-base font-medium text-text-secondary">
            Нет команд
          </p>
          <p className="mb-6 text-sm text-text-muted">
            Создайте первую команду, чтобы начать вести статистику
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-light"
          >
            <Plus className="h-4 w-4" />
            Создать команду
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-6">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      {/* FAB */}
      {(teams.length > 0 || showForm) && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className={cn(
            'fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 text-white transition hover:bg-primary-light active:scale-95',
            showForm && 'hidden',
          )}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}

export default TeamsPage;
