import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { useParams, Link } from 'react-router'
import type { Player, Team, Match, MatchEvent, PlayerMatchStats } from '@volleystats/shared'
import { POSITION_LABELS, ACTION_LABELS } from '@volleystats/shared'
import { ArrowLeft, Trophy, TrendingUp, Calendar } from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'

// Mock player stats for when no real data exists
const MOCK_PLAYER_STATS: PlayerMatchStats = {
  playerId: 'p-9',
  matchId: 'match-1',
  points: 12,
  errors: 3,
  serveTotal: 18,
  serveErrors: 2,
  serveAces: 3,
  attackTotal: 22,
  attackErrors: 4,
  attackBlocked: 2,
  attackPoints: 12,
  blockTotal: 6,
  blockErrors: 1,
  blockPoints: 2,
  receptionTotal: 15,
  receptionErrors: 2,
  receptionExcellent: 6,
  defenseTotal: 8,
  defenseErrors: 1,
  defenseExcellent: 3,
}

const MOCK_RECENT_GAMES = [
  { matchId: 'match-1', opponent: 'Комус', date: '17 мая', points: 12, attacks: 22, aces: 3, result: 'W', score: '3:0' },
  { matchId: 'match-2', opponent: 'Динамо', date: '10 мая', points: 8, attacks: 18, aces: 1, result: 'L', score: '1:3' },
  { matchId: 'match-3', opponent: 'Спартак', date: '3 мая', points: 15, attacks: 28, aces: 4, result: 'W', score: '3:1' },
]

type StatsTab = 'match' | 'season' | 'career'

function AttackEfficiencyChart({ percent }: { percent: number }) {
  const data = [{ value: percent, fill: '#3B82F6' }]

  return (
    <div className="relative flex items-center justify-center">
      <RadialBarChart
        width={200}
        height={200}
        cx={100}
        cy={100}
        innerRadius={70}
        outerRadius={90}
        barSize={12}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: 'rgba(59, 130, 246, 0.15)' }}
          dataKey="value"
          angleAxisId={0}
          cornerRadius={6}
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-text-primary">{percent}%</span>
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Эффективность</span>
      </div>
    </div>
  )
}

function StatBlock({
  value,
  label,
  color = 'text-text-primary',
}: {
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-xl font-bold tabular-nums', color)}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
    </div>
  )
}

function SkillSection({
  title,
  stats,
}: {
  title: string
  stats: { label: string; value: string | number; color?: string }[]
}) {
  return (
    <div className="glass p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-0.5">
            <span className={cn('text-lg font-bold tabular-nums', s.color ?? 'text-text-primary')}>
              {s.value}
            </span>
            <span className="text-[10px] text-text-muted">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function computePlayerStats(events: MatchEvent[], playerId: string): PlayerMatchStats | null {
  const playerEvents = events.filter((e) => e.playerId === playerId)
  if (playerEvents.length === 0) return null

  const serves = playerEvents.filter((e) => e.action === 'serve')
  const attacks = playerEvents.filter((e) => e.action === 'attack')
  const blocks = playerEvents.filter((e) => e.action === 'block')
  const receptions = playerEvents.filter((e) => e.action === 'reception')
  const defenses = playerEvents.filter((e) => e.action === 'defense')

  return {
    playerId,
    matchId: events[0]?.matchId ?? '',
    points:
      serves.filter((e) => e.result === 'success').length +
      attacks.filter((e) => e.result === 'success').length +
      blocks.filter((e) => e.result === 'success').length,
    errors: playerEvents.filter((e) => e.result === 'error').length,
    serveTotal: serves.length,
    serveErrors: serves.filter((e) => e.result === 'error').length,
    serveAces: serves.filter((e) => e.result === 'success').length,
    attackTotal: attacks.length,
    attackErrors: attacks.filter((e) => e.result === 'error' && e.meta?.quality !== 'attack_blocked').length,
    attackBlocked: attacks.filter((e) => e.meta?.quality === 'attack_blocked').length,
    attackPoints: attacks.filter((e) => e.result === 'success').length,
    blockTotal: blocks.length,
    blockErrors: blocks.filter((e) => e.result === 'error').length,
    blockPoints: blocks.filter((e) => e.result === 'success').length,
    receptionTotal: receptions.length,
    receptionErrors: receptions.filter((e) => e.result === 'error').length,
    receptionExcellent: receptions.filter((e) => e.result === 'success').length,
    defenseTotal: defenses.length,
    defenseErrors: defenses.filter((e) => e.result === 'error').length,
    defenseExcellent: defenses.filter((e) => e.result === 'success').length,
  }
}

export function PlayerStatsPage() {
  const { playerId } = useParams<{ playerId: string }>()

  const teams = useLiveQuery(() => db.teams.toArray()) ?? []
  const allEvents = useLiveQuery(
    () => (playerId ? db.matchEvents.where('playerId').equals(playerId).toArray() : []),
    [playerId],
  ) ?? []
  const matches = useLiveQuery(() => db.matches.toArray()) ?? []

  // Find the player and their team
  const { player, team } = useMemo(() => {
    for (const t of teams) {
      const p = t.players.find((p) => p.id === playerId)
      if (p) return { player: p, team: t }
    }
    return { player: undefined, team: undefined }
  }, [teams, playerId])

  const computedStats = useMemo(() => {
    if (!playerId) return null
    return computePlayerStats(allEvents, playerId)
  }, [allEvents, playerId])

  const stats = computedStats ?? MOCK_PLAYER_STATS

  const attackEfficiency = stats.attackTotal > 0
    ? Math.round((stats.attackPoints / stats.attackTotal) * 100)
    : 54 // default mock value

  if (!player) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-text-muted">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-safe pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <Link
          to={team ? `/teams/${team.id}` : '/teams'}
          className="rounded-full p-2 hover:bg-surface-light"
        >
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <h1 className="text-lg font-bold">Статистика игрока</h1>
      </div>

      {/* Player Profile */}
      <div className="glass mb-6 flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-extrabold text-primary">
          {player.number}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-text-primary">
            {player.lastName} {player.firstName}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">{team?.name}</span>
            <span className="text-text-muted">|</span>
            <span className="text-sm text-text-muted">{POSITION_LABELS[player.position]}</span>
          </div>
        </div>
      </div>

      {/* Tabs: Match / Season / Career (visual only, showing match data) */}
      <div className="mb-6 flex gap-1 rounded-xl bg-surface-light p-1">
        {[
          { key: 'match', label: 'Матч' },
          { key: 'season', label: 'Сезон' },
          { key: 'career', label: 'Карьера' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={cn(
              'flex-1 rounded-lg px-3 py-2.5 text-xs font-medium transition',
              tab.key === 'match'
                ? 'bg-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Attack Efficiency Chart */}
      <div className="glass mb-6 flex flex-col items-center p-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Эффективность атаки
        </h3>
        <AttackEfficiencyChart percent={attackEfficiency} />
        <div className="mt-4 flex w-full justify-around">
          <StatBlock value={stats.points} label="Очков" color="text-success" />
          <StatBlock value={stats.errors} label="Ошибок" color="text-error" />
          <StatBlock value={stats.attackTotal + stats.serveTotal + stats.blockTotal} label="Всего" />
        </div>
      </div>

      {/* Serve Stats */}
      <div className="mb-3">
        <SkillSection
          title="Подача"
          stats={[
            { label: 'Эйсы', value: stats.serveAces, color: 'text-success' },
            { label: 'Ошибки', value: stats.serveErrors, color: 'text-error' },
            { label: 'Всего', value: stats.serveTotal },
          ]}
        />
      </div>

      {/* Reception Stats */}
      <div className="mb-3">
        <SkillSection
          title="Приём"
          stats={[
            { label: 'Отлично', value: stats.receptionExcellent, color: 'text-success' },
            { label: 'Ошибки', value: stats.receptionErrors, color: 'text-error' },
            { label: 'Всего', value: stats.receptionTotal },
          ]}
        />
      </div>

      {/* Block Stats */}
      <div className="mb-6">
        <SkillSection
          title="Блок"
          stats={[
            { label: 'Очки', value: stats.blockPoints, color: 'text-success' },
            { label: 'Ошибки', value: stats.blockErrors, color: 'text-error' },
            { label: 'Всего', value: stats.blockTotal },
          ]}
        />
      </div>

      {/* Recent Games */}
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Последние игры
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {MOCK_RECENT_GAMES.map((game) => (
          <div key={game.matchId} className="glass flex items-center gap-3 p-3">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold',
                game.result === 'W' ? 'bg-success/20 text-success' : 'bg-error/20 text-error',
              )}
            >
              {game.result === 'W' ? 'W' : 'L'}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">vs {game.opponent}</div>
              <div className="text-xs text-text-muted">
                {game.date} -- {game.score}
              </div>
            </div>
            <div className="flex gap-4 text-right">
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-text-primary">{game.points}</span>
                <span className="text-[9px] text-text-muted">Очки</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-text-primary">{game.attacks}</span>
                <span className="text-[9px] text-text-muted">Атаки</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-primary">{game.aces}</span>
                <span className="text-[9px] text-text-muted">Эйсы</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PlayerStatsPage;
