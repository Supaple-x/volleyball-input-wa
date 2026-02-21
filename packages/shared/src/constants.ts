import type { Position, ActionType, ActionResult, RallyPhase } from './types'

// === Названия позиций ===
export const POSITION_LABELS: Record<Position, string> = {
  setter: 'Связующий',
  opposite: 'Диагональный',
  outside: 'Доигровщик',
  middle: 'Центральный',
  libero: 'Либеро',
}

// === Названия действий ===
export const ACTION_LABELS: Record<ActionType, string> = {
  serve: 'Подача',
  attack: 'Атака',
  block: 'Блок',
  reception: 'Приём',
  defense: 'Защита',
}

// === Названия результатов ===
export const RESULT_LABELS: Record<ActionResult, string> = {
  success: 'Успешно',
  error: 'Ошибка',
  neutral: 'Нейтрально',
}

// === Цвета результатов ===
export const RESULT_COLORS: Record<ActionResult, string> = {
  success: '#22c55e',
  error: '#ef4444',
  neutral: '#6b7280',
}

// === Правила волейбола ===
export const VOLLEYBALL_RULES = {
  POINTS_TO_WIN_SET: 25,
  POINTS_TO_WIN_TIEBREAK: 15,
  MIN_ADVANTAGE: 2,
  SETS_TO_WIN: 3,
  MAX_SETS: 5,
  TIEBREAK_SET: 5,
  MAX_TIMEOUTS_PER_SET: 2,
  MAX_SUBSTITUTIONS_PER_SET: 6,
  PLAYERS_ON_COURT: 6,
} as const

// === Зоны площадки: координаты для визуализации ===
// Нумерация по волейбольным правилам: 1-правая задняя, 2-правая передняя, и т.д.
export const COURT_ZONES_LAYOUT = {
  front: [4, 3, 2] as const,  // Передняя линия (слева направо)
  back: [5, 6, 1] as const,   // Задняя линия (слева направо)
}

// === Фазы розыгрыша ===
export const RALLY_PHASE_LABELS: Record<RallyPhase, string> = {
  idle: 'Ожидание',
  serve: 'Подача',
  reception: 'Приём',
  in_play: 'Игра',
  rally_over: 'Розыгрыш завершён',
}

// === Зоны: передняя / задняя линия ===
export const FRONT_ROW_ZONES = [2, 3, 4] as const
export const BACK_ROW_ZONES = [1, 5, 6] as const

// === Конфиги качества подачи ===
export const SERVE_QUALITY_ACTIONS = [
  { quality: 'ace', label: 'Эйс', result: 'success' as const, variant: 'success' as const },
  { quality: 'pressure', label: 'Услож', result: 'neutral' as const, variant: 'neutral' as const },
  { quality: 'in_play', label: 'В игру', result: 'neutral' as const, variant: 'neutral' as const },
  { quality: 'serve_error', label: 'Ошиб', result: 'error' as const, variant: 'error' as const },
] as const

// === Конфиги качества приёма ===
export const RECEPTION_QUALITY_ACTIONS = [
  { quality: 'excellent', label: '++', result: 'success' as const, variant: 'success' as const, row: 1 },
  { quality: 'positive', label: '+', result: 'success' as const, variant: 'success' as const, row: 1 },
  { quality: 'ok', label: '!', result: 'neutral' as const, variant: 'neutral' as const, row: 1 },
  { quality: 'negative', label: '−', result: 'neutral' as const, variant: 'neutral' as const, row: 1 },
  { quality: 'over', label: '/', result: 'neutral' as const, variant: 'neutral' as const, row: 2 },
  { quality: 'half', label: '=', result: 'neutral' as const, variant: 'neutral' as const, row: 2 },
  { quality: 'reception_error', label: 'Ошиб', result: 'error' as const, variant: 'error' as const, row: 2 },
] as const
