import type { RallyPhase, ActionType, ActionResult } from '@volleystats/shared'
import { type PhaseActions, getAvailableActions, getAwayAvailableActions } from '@/lib/matchEngine'
import { cn } from '@/lib/utils'
import { Star, X } from 'lucide-react'

function ActionBtn({
  label,
  icon,
  variant,
  disabled,
  onPress,
}: {
  label: string
  icon?: React.ReactNode
  variant: 'success' | 'error' | 'neutral'
  disabled: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className={cn(
        'touch-target flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all active:scale-95',
        variant === 'success' && 'border-success/40 bg-success/20 text-success active:bg-success/30',
        variant === 'error' && 'border-error/40 bg-error/20 text-error active:bg-error/30',
        variant === 'neutral' && 'border-border-light bg-surface-light text-text-secondary',
        disabled && 'opacity-30 pointer-events-none',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function ActionPanel({
  phase,
  servingTeamId,
  receivingTeamId,
  selectedPlayerId,
  selectedTeamId,
  isAwayPlayerSelected,
  disabled,
  onAction,
  onOpponentError,
}: {
  phase: RallyPhase
  servingTeamId: string
  receivingTeamId: string
  selectedPlayerId: string | null
  selectedTeamId: string | null
  isAwayPlayerSelected: boolean
  disabled: boolean
  onAction: (action: ActionType, result: ActionResult, quality?: string) => void
  onOpponentError: () => void
}) {
  // Get actions: simplified for away players, full for home
  const phaseActions: PhaseActions = isAwayPlayerSelected
    ? getAwayAvailableActions(phase, servingTeamId)
    : getAvailableActions(phase, servingTeamId, receivingTeamId)

  // Check if a player is selected from the expected team
  const isCorrectTeam = phaseActions.expectedTeamId === null || selectedTeamId === phaseActions.expectedTeamId
  const isDisabled = disabled || !selectedPlayerId || !isCorrectTeam

  if (phase === 'idle' || phase === 'rally_over') {
    return null
  }

  // Away player selected during reception — don't show actions (no quality tracking for opponent)
  if (isAwayPlayerSelected && phase === 'reception') {
    return null
  }

  // For reception phase: render in 2 rows (4 + 3)
  if (phase === 'reception' && phaseActions.sections.length > 0) {
    const actions = phaseActions.sections[0].actions
    const row1 = actions.slice(0, 4)
    const row2 = actions.slice(4)

    return (
      <div className="px-3 space-y-2">
        {/* Prompt */}
        <p className="text-[11px] text-text-muted text-center">{phaseActions.prompt}</p>

        <div>
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block px-1">
            {phaseActions.sections[0].title}
          </span>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {row1.map((a) => (
              <ActionBtn
                key={a.quality || a.label}
                label={a.label}
                variant={a.variant}
                disabled={isDisabled}
                icon={a.quality === 'reception_error' ? <X size={12} strokeWidth={3} /> : undefined}
                onPress={() => onAction(a.action, a.result, a.quality)}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {row2.map((a) => (
              <ActionBtn
                key={a.quality || a.label}
                label={a.label}
                variant={a.variant}
                disabled={isDisabled}
                icon={a.quality === 'reception_error' ? <X size={12} strokeWidth={3} /> : undefined}
                onPress={() => onAction(a.action, a.result, a.quality)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 space-y-2">
      {/* Prompt */}
      <p className="text-[11px] text-text-muted text-center">{phaseActions.prompt}</p>

      {/* Action sections */}
      {phaseActions.sections.map((section) => (
        <div key={section.title}>
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 block px-1">
            {section.title}
          </span>
          <div className="flex gap-2">
            {section.actions.map((a) => (
              <ActionBtn
                key={a.quality || `${a.action}-${a.result}`}
                label={a.label}
                variant={a.variant}
                disabled={isDisabled}
                icon={
                  a.quality === 'ace' ? <Star size={12} fill="currentColor" /> :
                  a.quality === 'serve_error' || a.quality === 'reception_error' ? <X size={12} strokeWidth={3} /> :
                  undefined
                }
                onPress={() => onAction(a.action, a.result, a.quality)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Opponent Error button (only in in_play phase) */}
      {phase === 'in_play' && (
        <div>
          <button
            type="button"
            onClick={onOpponentError}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl border border-warning/40 bg-warning/10 py-2.5 text-xs font-semibold text-warning transition-all active:scale-[0.98] active:bg-warning/20',
              disabled && 'opacity-30 pointer-events-none',
            )}
          >
            Ошибка соперника +1
          </button>
        </div>
      )}
    </div>
  )
}
