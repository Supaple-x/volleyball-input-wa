import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { Link } from 'react-router'
import type { Match, Team } from '@volleystats/shared'
import { Search, Plus, Trophy, Calendar } from 'lucide-react'

type FilterChip = 'all' | 'september' | 'october' | 'season_2025'

const FILTER_OPTIONS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'september', label: 'Сентябрь' },
  { key: 'october', label: 'Октябрь' },
  { key: 'season_2025', label: 'Сезон 2025' },
]

function TeamBadge({
  name,
  shortName,
  color = 'bg-primary/20 text-primary',
}: {
  name: string
  shortName?: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold',
          color,
        )}
      >
        {shortName || name.slice(0, 2).toUpperCase()}
      </div>
      <span className="max-w-[80px] truncate text-[11px] text-text-secondary">{name}</span>
    </div>
  )
}

function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const home = teams.find((t) => t.id === match.homeTeamId)
  const away = teams.find((t) => t.id === match.awayTeamId)
  const setsWonHome = match.sets.filter((s) => s.isFinished && s.scoreHome > s.scoreAway).length
  const setsWonAway = match.sets.filter((s) => s.isFinished && s.scoreAway > s.scoreHome).length

  const dateStr = new Date(match.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = new Date(match.date).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const link =
    match.status === 'live'
      ? `/matches/${match.id}/live`
      : `/matches/${match.id}/stats`

  return (
    <Link to={link} className="glass block p-4 transition hover:border-border-light">
      {/* Date and Status */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">
            {dateStr}, {timeStr}
          </span>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase',
            match.status === 'live'
              ? 'bg-success/20 text-success'
              : match.status === 'finished'
                ? 'bg-text-muted/20 text-text-muted'
                : 'bg-warning/20 text-warning',
          )}
        >
          {match.status === 'live' ? 'Live' : match.status === 'finished' ? 'Завершён' : 'Настройка'}
        </span>
      </div>

      {/* Teams and Score */}
      <div className="flex items-center justify-between">
        <TeamBadge
          name={home?.name ?? '?'}
          shortName={home?.shortName}
          color="bg-primary/20 text-primary"
        />

        <div className="text-center">
          <div className="text-3xl font-extrabold tabular-nums text-text-primary">
            {setsWonHome} : {setsWonAway}
          </div>
          {/* Set scores */}
          <div className="mt-1.5 flex gap-1.5">
            {match.sets
              .filter((s) => s.isFinished)
              .map((s, i) => (
                <span
                  key={i}
                  className="rounded bg-surface-light px-2 py-0.5 text-[10px] font-mono tabular-nums text-text-muted"
                >
                  {s.scoreHome}:{s.scoreAway}
                </span>
              ))}
          </div>
        </div>

        <TeamBadge
          name={away?.name ?? '?'}
          shortName={away?.shortName}
          color="bg-warning/20 text-warning"
        />
      </div>
    </Link>
  )
}

export function MatchHistoryPage() {
  const teams = useLiveQuery(() => db.teams.toArray()) ?? []
  const matches = useLiveQuery(() => db.matches.orderBy('date').reverse().toArray()) ?? []

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all')

  const filteredMatches = useMemo(() => {
    let result = matches

    // Search by team name
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((m) => {
        const home = teams.find((t) => t.id === m.homeTeamId)
        const away = teams.find((t) => t.id === m.awayTeamId)
        return (
          home?.name.toLowerCase().includes(q) ||
          away?.name.toLowerCase().includes(q) ||
          home?.shortName?.toLowerCase().includes(q) ||
          away?.shortName?.toLowerCase().includes(q)
        )
      })
    }

    // Filter by date
    if (activeFilter !== 'all') {
      result = result.filter((m) => {
        const d = new Date(m.date)
        if (activeFilter === 'september') return d.getMonth() === 8
        if (activeFilter === 'october') return d.getMonth() === 9
        if (activeFilter === 'season_2025') return d.getFullYear() === 2025
        return true
      })
    }

    return result
  }, [matches, teams, search, activeFilter])

  return (
    <div className="px-4 pt-safe pb-24">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">История матчей</h1>
        </div>
        <span className="text-sm text-text-muted">
          {matches.length} {matches.length === 1 ? 'матч' : 'матчей'}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию команды..."
          className="w-full rounded-xl border border-border bg-surface-light py-3 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary"
        />
      </div>

      {/* Filter Chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-xs font-medium transition',
              activeFilter === filter.key
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'border border-border text-text-muted hover:border-border-light hover:text-text-secondary',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Match List */}
      {filteredMatches.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 py-12 text-center">
          <Trophy className="h-10 w-10 text-text-muted/40" />
          <p className="text-sm text-text-muted">
            {search ? 'Ничего не найдено' : 'Нет матчей'}
          </p>
          <Link
            to="/matches/new"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Создать матч
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} teams={teams} />
          ))}
        </div>
      )}

      {/* FAB */}
      <Link
        to="/matches/new"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 transition active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  )
}

export default MatchHistoryPage;
