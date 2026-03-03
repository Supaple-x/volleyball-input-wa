import { useState, useMemo } from 'react'
import type { Team, Player, CourtZone, LineupEntry } from '@volleystats/shared'
import { cn } from '@/lib/utils'
import { UserPlus, X, Copy } from 'lucide-react'

const HORIZONTAL_ROWS: readonly [CourtZone, CourtZone][] = [
  [5, 4],
  [6, 3],
  [1, 2],
]

interface LineupState {
  zones: Partial<Record<CourtZone, string>>
}

export function SetupLineupModal({
  homeTeam,
  setNumber,
  previousHomeLineup,
  onConfirm,
  onCancel,
}: {
  homeTeam: Team
  setNumber: number
  previousHomeLineup?: LineupEntry[]
  onConfirm: (homeLineup: LineupEntry[]) => void
  onCancel: () => void
}) {
  const [homeLineup, setHomeLineup] = useState<LineupState>({ zones: {} })
  const [pickerZone, setPickerZone] = useState<CourtZone | null>(null)

  const homeCount = Object.keys(homeLineup.zones).length
  const canConfirm = homeCount === 6

  const copyFromPrevious = () => {
    if (!previousHomeLineup || previousHomeLineup.length === 0) return
    const zones: Partial<Record<CourtZone, string>> = {}
    for (const entry of previousHomeLineup) {
      zones[entry.zone] = entry.playerId
    }
    setHomeLineup({ zones })
  }

  const assignedIds = useMemo(() => {
    return new Set(Object.values(homeLineup.zones).filter(Boolean) as string[])
  }, [homeLineup])

  const pickerPlayers = homeTeam.players
    .filter((p) => p.position !== 'libero' && !assignedIds.has(p.id))

  const handleSelect = (playerId: string) => {
    if (pickerZone === null) return
    setHomeLineup((prev) => ({ zones: { ...prev.zones, [pickerZone]: playerId } }))
    setPickerZone(null)
  }

  const handleClear = (zone: CourtZone) => {
    setHomeLineup((prev) => {
      const newZones = { ...prev.zones }
      delete newZones[zone]
      return { zones: newZones }
    })
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    const entries: LineupEntry[] = Object.entries(homeLineup.zones).map(([zone, playerId]) => ({
      playerId: playerId!,
      zone: Number(zone) as CourtZone,
      isLibero: false,
    }))
    onConfirm(entries)
  }

  const getPlayer = (zone: CourtZone): Player | undefined => {
    const id = homeLineup.zones[zone]
    return id ? homeTeam.players.find((p) => p.id === id) : undefined
  }

  const renderZone = (zone: CourtZone) => {
    const player = getPlayer(zone)
    return (
      <button
        key={zone}
        onClick={() => player ? handleClear(zone) : setPickerZone(zone)}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border text-xs font-bold transition-all',
          player
            ? 'border-primary/40 bg-primary/20 text-primary'
            : 'border-dashed border-text-muted/30 text-text-muted',
        )}
        style={player ? {
          borderColor: 'var(--color-primary)',
          backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
          color: 'var(--color-primary)',
        } : undefined}
      >
        {player ? player.number : <UserPlus size={14} />}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-center text-lg font-bold">
          Расстановка — Сет {setNumber}
        </h2>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                {homeTeam.shortName || homeTeam.name} ({homeCount}/6)
              </span>
              {previousHomeLineup && previousHomeLineup.length > 0 && (
                <button
                  onClick={copyFromPrevious}
                  className="flex items-center gap-1 rounded-lg bg-surface-light px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary"
                >
                  <Copy size={10} />
                  Из сета {setNumber - 1}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {HORIZONTAL_ROWS.map(([backZone, frontZone]) => (
                <div key={`${backZone}-${frontZone}`} className="flex justify-around">
                  {renderZone(backZone)}
                  {renderZone(frontZone)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-light"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'flex-1 rounded-xl px-4 py-3 text-sm font-bold transition',
              canConfirm
                ? 'bg-success text-white active:scale-[0.98]'
                : 'bg-surface-light text-text-muted cursor-not-allowed',
            )}
          >
            Начать сет
          </button>
        </div>
      </div>

      {/* Player picker */}
      {pickerZone !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4" onClick={() => setPickerZone(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Зона {pickerZone}</span>
              <button onClick={() => setPickerZone(null)} className="p-1">
                <X size={18} className="text-text-muted" />
              </button>
            </div>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {pickerPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-light"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {p.number}
                  </span>
                  <span className="text-sm">{p.lastName} {p.firstName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
