import { db } from '@/db/database'
import type { Match, Team, MatchEvent, Player, PlayerMatchStats } from '@volleystats/shared'
import { ALL_AWAY_IDS, getAwayPlayerDisplayName } from '@/lib/awayPlayers'

function computePlayerStats(
  events: MatchEvent[],
  player: Player,
  teamId: string,
  matchId: string,
): PlayerMatchStats {
  const pe = events.filter((e) => e.teamId === teamId && e.playerId === player.id)

  const serves = pe.filter((e) => e.action === 'serve')
  const attacks = pe.filter((e) => e.action === 'attack')
  const blocks = pe.filter((e) => e.action === 'block')
  const receptions = pe.filter((e) => e.action === 'reception')
  const defense = pe.filter((e) => e.action === 'defense')

  const serveAces = serves.filter((e) => e.meta?.quality === 'ace').length
  const serveErrors = serves.filter((e) => e.result === 'error').length
  const attackPoints = attacks.filter((e) => e.result === 'success' || e.meta?.quality === 'attack_kill').length
  const attackErrors = attacks.filter((e) => e.result === 'error' && e.meta?.quality !== 'attack_blocked').length
  const attackBlocked = attacks.filter((e) => e.meta?.quality === 'attack_blocked').length
  const blockPoints = blocks.filter((e) => e.result === 'success').length
  const blockErrors = blocks.filter((e) => e.result === 'error').length
  const receptionExcellent = receptions.filter((e) => e.result === 'success').length
  const receptionErrors = receptions.filter((e) => e.result === 'error').length
  const defenseExcellent = defense.filter((e) => e.result === 'success').length
  const defenseErrors = defense.filter((e) => e.result === 'error').length

  const points = serveAces + attackPoints + blockPoints
  const errors = serveErrors + attackErrors + blockErrors + receptionErrors + defenseErrors

  return {
    playerId: player.id,
    matchId,
    points,
    errors,
    serveTotal: serves.length,
    serveErrors,
    serveAces,
    attackTotal: attacks.length,
    attackErrors,
    attackBlocked,
    attackPoints,
    blockTotal: blocks.length,
    blockErrors,
    blockPoints,
    receptionTotal: receptions.length,
    receptionErrors,
    receptionExcellent,
    defenseTotal: defense.length,
    defenseErrors,
    defenseExcellent,
  }
}

function sumStats(statsArr: PlayerMatchStats[]): PlayerMatchStats {
  const sum: PlayerMatchStats = {
    playerId: '',
    matchId: '',
    points: 0,
    errors: 0,
    serveTotal: 0,
    serveErrors: 0,
    serveAces: 0,
    attackTotal: 0,
    attackErrors: 0,
    attackBlocked: 0,
    attackPoints: 0,
    blockTotal: 0,
    blockErrors: 0,
    blockPoints: 0,
    receptionTotal: 0,
    receptionErrors: 0,
    receptionExcellent: 0,
    defenseTotal: 0,
    defenseErrors: 0,
    defenseExcellent: 0,
  }
  for (const s of statsArr) {
    sum.points += s.points
    sum.errors += s.errors
    sum.serveTotal += s.serveTotal
    sum.serveErrors += s.serveErrors
    sum.serveAces += s.serveAces
    sum.attackTotal += s.attackTotal
    sum.attackErrors += s.attackErrors
    sum.attackBlocked += s.attackBlocked
    sum.attackPoints += s.attackPoints
    sum.blockTotal += s.blockTotal
    sum.blockErrors += s.blockErrors
    sum.blockPoints += s.blockPoints
    sum.receptionTotal += s.receptionTotal
    sum.receptionErrors += s.receptionErrors
    sum.receptionExcellent += s.receptionExcellent
    sum.defenseTotal += s.defenseTotal
    sum.defenseErrors += s.defenseErrors
    sum.defenseExcellent += s.defenseExcellent
  }
  return sum
}

function statsToRow(
  num: number | string,
  name: string,
  s: PlayerMatchStats,
): (string | number)[] {
  return [
    num,
    name,
    s.points,
    s.errors,
    s.serveTotal,
    s.serveErrors,
    s.serveAces,
    s.attackTotal,
    s.attackErrors,
    s.attackBlocked,
    s.attackPoints,
    s.blockTotal,
    s.blockErrors,
    s.blockPoints,
    s.defenseTotal,
    s.defenseErrors,
    s.defenseExcellent,
    s.receptionTotal,
    s.receptionErrors,
    s.receptionExcellent,
  ]
}

function buildTeamBlock(
  team: Team,
  events: MatchEvent[],
  matchId: string,
): (string | number)[][] {
  const rows: (string | number)[][] = []

  // Team name header
  rows.push([team.name])

  // Column headers row 1 (merged categories)
  rows.push([
    '№',
    'Фамилия Имя',
    'Очки',
    'Ошибки',
    'Подача',
    '',
    '',
    'Атака',
    '',
    '',
    '',
    'Блок',
    '',
    '',
    'Защитные действия',
    '',
    '',
    'Приём подачи',
    '',
    '',
  ])

  // Column headers row 2 (sub-columns)
  rows.push([
    '',
    '',
    '',
    '',
    'Всего',
    'Ошибки',
    'Эйсы',
    'Всего',
    'Ошибки',
    'Уд.в блок',
    'Очки',
    'Всего',
    'Ошибки',
    'Очки',
    'Всего',
    'Ошибки',
    'Отличный приём',
    'Всего',
    'Ошибки',
    'Отличный',
  ])

  // Player rows
  const allStats: PlayerMatchStats[] = []
  for (const player of team.players) {
    const ps = computePlayerStats(events, player, team.id, matchId)
    allStats.push(ps)
    rows.push(statsToRow(player.number, `${player.lastName} ${player.firstName}`, ps))
  }

  // Total row
  const total = sumStats(allStats)
  rows.push(statsToRow('', 'Итого', total))

  return rows
}

export async function exportMatchProtocol(matchId: string): Promise<void> {
  const XLSX = await import('xlsx')

  const match = await db.matches.get(matchId)
  if (!match) throw new Error('Матч не найден')

  const homeTeam = await db.teams.get(match.homeTeamId)
  const awayTeam = await db.teams.get(match.awayTeamId)
  if (!homeTeam || !awayTeam) throw new Error('Команды не найдены')

  const allEvents = await db.matchEvents.where('matchId').equals(matchId).toArray()
  // Filter out auto-generated mirror events to avoid double-counting
  const events = allEvents.filter((e) => !e.meta?.autoGenerated)

  // Build score string
  const setsWonHome = match.sets.filter((s) => s.isFinished && s.scoreHome > s.scoreAway).length
  const setsWonAway = match.sets.filter((s) => s.isFinished && s.scoreAway > s.scoreHome).length
  const setScores = match.sets
    .filter((s) => s.isFinished)
    .map((s) => `${s.scoreHome}:${s.scoreAway}`)
    .join(', ')

  const title = `${homeTeam.name} - ${awayTeam.name}`
  const score = `${setsWonHome}:${setsWonAway} (${setScores})`

  // Build sheet data
  const data: (string | number)[][] = []

  // Title rows
  data.push([title])
  data.push([score])
  data.push([]) // blank row

  // Home team block
  const homeBlock = buildTeamBlock(homeTeam, events, matchId)
  data.push(...homeBlock)

  data.push([]) // blank row

  // Away team block — use synthetic players for generic away IDs
  const awayPlayers: Player[] = awayTeam.players.length > 0
    ? awayTeam.players
    : ALL_AWAY_IDS
        .filter((id) => events.some((e) => e.teamId === awayTeam.id && e.playerId === id))
        .map((id, i) => ({
          id,
          number: i + 1,
          firstName: '',
          lastName: getAwayPlayerDisplayName(id),
          position: 'outside' as const,
        }))
  const awayTeamForExport = { ...awayTeam, players: awayPlayers.length > 0 ? awayPlayers : awayTeam.players }
  const awayBlock = buildTeamBlock(awayTeamForExport, events, matchId)
  data.push(...awayBlock)

  // Create workbook
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 4 },  // №
    { wch: 22 }, // Фамилия Имя
    { wch: 6 },  // Очки
    { wch: 7 },  // Ошибки
    { wch: 6 },  // Подача Всего
    { wch: 7 },  // Подача Ошибки
    { wch: 6 },  // Подача Эйсы
    { wch: 6 },  // Атака Всего
    { wch: 7 },  // Атака Ошибки
    { wch: 9 },  // Атака Уд.в блок
    { wch: 6 },  // Атака Очки
    { wch: 6 },  // Блок Всего
    { wch: 7 },  // Блок Ошибки
    { wch: 6 },  // Блок Очки
    { wch: 6 },  // Защита Всего
    { wch: 7 },  // Защита Ошибки
    { wch: 12 }, // Защита Отличный приём
    { wch: 6 },  // Приём Всего
    { wch: 7 },  // Приём Ошибки
    { wch: 9 },  // Приём Отличный
  ]

  // Merge title cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } }, // Title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 19 } }, // Score
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Протокол')

  // Download
  const filename = `Статистика ${homeTeam.name} - ${awayTeam.name}.xlsx`
  XLSX.writeFile(wb, filename)
}
