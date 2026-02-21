import { useEffect } from 'react'
import { Link } from 'react-router'
import { Play, Settings, ChevronRight } from 'lucide-react'
import { useTeamStore } from '@/stores/teamStore'
import { useMatchStore } from '@/stores/matchStore'
import { cn } from '@/lib/utils'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Match, Team } from '@volleystats/shared'

function TeamBadge({ name, shortName }: { name: string; shortName?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-light text-xs font-bold text-text-primary">
        {shortName || name.slice(0, 2).toUpperCase()}
      </div>
      <span className="max-w-[80px] truncate text-xs text-text-secondary">{name}</span>
    </div>
  )
}

function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const home = teams.find((t) => t.id === match.homeTeamId)
  const away = teams.find((t) => t.id === match.awayTeamId)
  const totalHome = match.sets.filter((s) => s.scoreHome > s.scoreAway).length
  const totalAway = match.sets.filter((s) => s.scoreAway > s.scoreHome).length
  const dateStr = new Date(match.date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const link =
    match.status === 'live'
      ? `/matches/${match.id}/live`
      : `/matches/${match.id}/stats`

  return (
    <Link to={link} className="glass block p-4 transition hover:border-border-light">
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
            match.status === 'live'
              ? 'bg-success/20 text-success'
              : 'bg-text-muted/20 text-text-muted',
          )}
        >
          {match.status === 'live' ? 'Live' : 'Завершён'}
        </span>
        <span className="text-xs text-text-muted">{dateStr}</span>
      </div>

      <div className="flex items-center justify-between py-3">
        <TeamBadge name={home?.name ?? '?'} shortName={home?.shortName} />
        <div className="text-center">
          <div className="text-3xl font-extrabold tabular-nums">
            {totalHome} : {totalAway}
          </div>
          <div className="mt-1 flex gap-1.5 text-[11px] text-text-muted">
            {match.sets.map((s, i) => (
              <span key={i}>
                {s.scoreHome}:{s.scoreAway}
              </span>
            ))}
          </div>
        </div>
        <TeamBadge name={away?.name ?? '?'} shortName={away?.shortName} />
      </div>
    </Link>
  )
}

export function DashboardPage() {
  const teams = useLiveQuery(() => db.teams.toArray()) ?? []
  const matches = useLiveQuery(() => db.matches.orderBy('date').reverse().toArray()) ?? []

  return (
    <div className="px-4 pt-safe">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold">
            V
          </div>
          <h1 className="text-xl font-bold">VolleyStats</h1>
        </div>
      </div>

      {/* New Match CTA */}
      <div className="glass mb-6 p-6">
        <h2 className="mb-1 text-lg font-semibold">Новый матч</h2>
        <p className="mb-4 text-sm text-text-secondary">Готовы к игре?</p>
        <div className="flex gap-3">
          <Link
            to="/matches/new"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white transition hover:bg-primary-light"
          >
            <Play className="h-4 w-4" />
            Начать матч
          </Link>
          <Link
            to="/teams"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-text-secondary transition hover:border-border-light hover:text-text-primary"
          >
            <Settings className="h-4 w-4" />
            Настройки
          </Link>
        </div>
      </div>

      {/* Recent Matches */}
      {matches.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Последние матчи</h2>
            <Link
              to="/matches"
              className="flex items-center gap-1 text-xs text-primary"
            >
              Все
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {matches.slice(0, 3).map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </div>
        </section>
      )}

      {/* My Teams */}
      {teams.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Мои команды</h2>
            <Link
              to="/teams"
              className="flex items-center gap-1 text-xs text-primary"
            >
              Все
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {teams.map((team) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="glass flex min-w-[140px] flex-col items-center gap-2 p-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-light text-sm font-bold">
                  {team.shortName || team.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{team.name}</span>
                <span className="text-xs text-text-muted">
                  {team.players.length} игроков
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default DashboardPage;
